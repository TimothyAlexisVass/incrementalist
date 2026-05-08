defmodule Incrementalist.Game.CommandExecutor do
  @moduledoc """
  Decouples the business logic for executing gameplay commands from the queue
  persistence.

  It maps a `command_type` to game changes, processing the command intent and
  the current state, and applying changes to the database.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Persistence.{GameCommand, Player, SaveSlot, SaveSlots}
  alias Incrementalist.Game.{Snapshots, Time}
  alias Incrementalist.Game.Features.Progress.Bar
  alias Incrementalist.Repo
  import Ecto.Query

  @doc """
  Executes the game rules for a specific command.

  Returns a tuple `{status, result, save_slot_id}` to be recorded by the queue manager.
  """
  def execute(%GameCommand{} = command, %Player{} = player, now) do
    # The tuple captures the execution boundary: queue status, replayable client
    # payload, and the save slot affected by the command.
    case command.command_type do
      "game.noop" ->
        active_slot = active_slot(player, now)

        {"succeeded",
         %{
           "type" => "game.noop.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "server_time" => Time.iso8601(now),
           "events" => []
         }, active_slot.id}

      "progress.claim_in" ->
        active_slot = active_slot(player, now)
        {next_state, can_claim_in} = Bar.ensure_can_claim_at(active_slot.state, now)

        if next_state != active_slot.state do
          active_slot
          |> SaveSlot.changeset(%{state: next_state, last_saved_at: now})
          |> Repo.update!()
        end

        {"succeeded",
         %{
           "type" => "progress.claim_in.result",
           "command_id" => command.command_id,
           "can_claim_in" => can_claim_in
         }, active_slot.id}

      "progress.claim_reward" ->
        active_slot = active_slot(player, now)
        {scheduled_state, can_claim_in} = Bar.ensure_can_claim_at(active_slot.state, now)

        if can_claim_in <= 0 do
          # Compute changes and apply state logic
          new_state =
            scheduled_state
            |> Bar.claim_reward()
            |> Incrementalist.Game.Rewards.apply_level_ups()
            |> Bar.finalize_claim(now)

          updated_slot =
            SaveSlot.changeset(active_slot, %{state: new_state, last_saved_at: now})

          Repo.update!(updated_slot)

          {"succeeded",
           %{
             "type" => "progress.claim_reward.result",
             "command_id" => command.command_id,
             "coins" => new_state.coins,
             "exp" => new_state.exp,
             "level" => new_state.level,
             "shards" => new_state.shards,
             "cores" => new_state.cores
           }, active_slot.id}
        else
          {"failed",
           %{
             "type" => "command.error",
             "status" => "error",
             "command_id" => command.command_id,
             "reason" => "claim_not_ready",
             "can_claim_in" => can_claim_in
           }, active_slot.id}
        end

      "save_slots.list" ->
        active_slot = active_slot(player, now)

        {"succeeded",
         %{
           "type" => "save_slots.list.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "server_time" => Time.iso8601(now),
           "active_save_slot" => active_slot.slot_index,
           "slots" => SaveSlots.summaries(player.id, active_slot.slot_index)
         }, active_slot.id}

      "save_slot.switch" ->
        execute_switch(player, command, now)

      "save_slot.reset" ->
        execute_reset(player, command, now)

      _unknown ->
        active_slot = active_slot(player, now)

        {"failed", error_result("unknown_command", command), active_slot.id}
    end
  end

  defp execute_switch(%Player{} = player, %GameCommand{} = command, now) do
    active_slot = active_slot(player, now)

    with {:ok, slot_index} <- fetch_slot_index(command.intent) do
      # Switching is a command because the current active slot is server truth.
      # The previous slot is saved before the active pointer moves.
      target_had_state = SaveSlots.get_slot!(player.id, slot_index).state != nil
      use_cached_snapshot = target_had_state and cached_snapshot_hint?(command.intent)
      target_slot = SaveSlots.switch_player_to_slot(player, slot_index, now)
      clear_commands_after_save_boundary!(player.id, command.sequence, now)

      result =
        %{
          "type" => "save_slot.switch.result",
          "status" => "ok",
          "command_id" => command.command_id,
          "server_time" => Time.iso8601(now),
          "active_save_slot" => target_slot.slot_index,
          "save_slot" => Incrementalist.Game.State.summary(target_slot, target_slot.slot_index),
          "slots" => SaveSlots.summaries(player.id, target_slot.slot_index)
        }
        |> maybe_put_snapshot(target_slot, now, use_cached_snapshot)

      {"succeeded", result, target_slot.id}
    else
      {:error, reason} ->
        {"failed",
         error_result(reason, command, %{
           "active_save_slot" => active_slot.slot_index
         }), active_slot.id}
    end
  end

  defp execute_reset(%Player{} = player, %GameCommand{} = command, now) do
    active_slot = active_slot(player, now)
    reset_slot = SaveSlots.reset(active_slot, now)
    clear_commands_after_save_boundary!(player.id, command.sequence, now)

    {"succeeded",
     %{
       "type" => "save_slot.reset.result",
       "status" => "ok",
       "command_id" => command.command_id,
       "server_time" => Time.iso8601(now),
       "snapshot" => Snapshots.full(reset_slot, reset_slot.slot_index, now),
       "slots" => SaveSlots.summaries(player.id, reset_slot.slot_index)
     }, reset_slot.id}
  end

  defp active_slot(%Player{} = player, now) do
    # Commands such as slot switching can update the active pointer in this
    # transaction; reloading avoids using a stale struct for follow-up snapshots.
    player = Repo.get!(Player, player.id)
    SaveSlots.determine_active_slot(player, now)
  end

  defp clear_commands_after_save_boundary!(player_id, boundary_sequence, now) do
    Repo.update_all(
      from(command in GameCommand,
        where:
          command.player_id == ^player_id and command.sequence > ^boundary_sequence and
            command.status == "queued" and is_nil(command.acked_at)
      ),
      set: [status: "acked", acked_at: now]
    )
  end

  defp fetch_slot_index(%{"slot_index" => slot_index}), do: normalize_slot_index(slot_index)
  defp fetch_slot_index(%{slot_index: slot_index}), do: normalize_slot_index(slot_index)
  defp fetch_slot_index(_intent), do: {:error, "slot_index_required"}

  defp normalize_slot_index(slot_index)
       when is_integer(slot_index) do
    if slot_index in Constants.valid_slot_indexes() do
      {:ok, slot_index}
    else
      {:error, "invalid_slot_index"}
    end
  end

  defp normalize_slot_index(slot_index) when is_binary(slot_index) do
    with {integer, ""} <- Integer.parse(slot_index),
         true <- integer in Constants.valid_slot_indexes() do
      {:ok, integer}
    else
      _ -> {:error, "invalid_slot_index"}
    end
  end

  defp normalize_slot_index(_slot_index), do: {:error, "invalid_slot_index"}

  defp cached_snapshot_hint?(%{"has_cached_snapshot" => true}), do: true
  defp cached_snapshot_hint?(%{has_cached_snapshot: true}), do: true
  defp cached_snapshot_hint?(_intent), do: false

  defp maybe_put_snapshot(result, _target_slot, _now, true), do: result

  defp maybe_put_snapshot(result, target_slot, now, false) do
    Map.put(result, "snapshot", Snapshots.full(target_slot, target_slot.slot_index, now))
  end

  defp error_result(reason, command, extra \\ %{}) do
    extra
    |> Map.merge(%{
      "type" => "command.error",
      "status" => "error",
      "command_id" => command.command_id,
      "reason" => reason
    })
  end
end
