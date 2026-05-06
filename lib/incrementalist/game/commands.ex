defmodule Incrementalist.Game.Commands do
  @moduledoc """
  Executes gameplay commands through a durable, server-owned FIFO queue.

  Each command is inserted with a client-assigned integer command id plus a
  server-assigned sequence before any game rule runs. Once a command leaves
  `queued`, its `result` column is the durable wire response for that command.
  Reconnects and withheld acknowledgements return that stored result exactly,
  so rule execution remains once-only.

  `command.ack` names only the client command id whose current blocking result
  was applied. The server still uses its private sequence to preserve FIFO
  execution and replay boundaries.
  """

  import Ecto.Query

  alias Incrementalist.Game.Persistence.{GameCommand, Player, SaveSlots}
  alias Incrementalist.Game.{Snapshots, Time}
  alias Incrementalist.Game.Features.Progress.Bar
  alias Incrementalist.Repo

  @queue_limit 10
  @processed_statuses ["succeeded", "failed"]
  @pending_statuses ["queued" | @processed_statuses]
  @slot_indexes 0..3
  @command_id_slots 0..9

  def enqueue(player_id, command_type, intent \\ %{}, now \\ Time.now())
      when is_binary(command_type) do
    with {:ok, command_id, command_intent} <- extract_command_id(intent) do
      Repo.transaction(fn ->
        # Locking the player row gives every queue mutation the same serialization point.
        # Without this, two sockets could both see an empty queue and execute out of order.
        player = lock_player!(player_id)

        case pending_command_by_client_id(player.id, command_id) do
          %GameCommand{} = command ->
            command_result(command)

          nil ->
            if save_boundary_pending?(player.id) or
                 pending_command_count(player.id) >= @queue_limit do
              :queue_full
            else
              command = insert_command(player.id, command_id, command_type, command_intent, now)

              case process_next_queued(player, now) do
                {:processed, processed_command} ->
                  processed_command.result

                :blocked ->
                  queued_result(command)
              end
            end
        end
      end)
      |> unwrap_transaction()
    end
  end

  def ack(player_id, command_id, now \\ Time.now()) do
    with {:ok, command_id} <- normalize_command_id(command_id) do
      Repo.transaction(fn ->
        player = lock_player!(player_id)

        case current_unacked_command(player.id) do
          %GameCommand{command_id: ^command_id} = command ->
            command
            |> GameCommand.changeset(%{status: "acked", acked_at: now})
            |> Repo.update!()

            released_result =
              case process_next_queued(player, now) do
                {:processed, next_command} -> next_command.result
                :blocked -> nil
              end

            ack_result(command_id, released_result)

          _not_current ->
            ack_result(command_id, nil)
        end
      end)
      |> unwrap_transaction()
    end
  end

  def replay_pending(player_id) do
    Repo.transaction(fn ->
      player = lock_player!(player_id)

      case current_unacked_command(player.id) do
        nil ->
          nil

        command ->
          # Replay must not consult rule code or reload current save facts. The
          # saved result is the exact response the client failed to acknowledge.
          {1, _} =
            Repo.update_all(
              from(game_command in GameCommand, where: game_command.id == ^command.id),
              inc: [replay_count: 1]
            )

          command.result
      end
    end)
    |> unwrap_transaction()
  end

  defp process_next_queued(%Player{} = player, now) do
    if current_unacked_command(player.id) do
      # A processed-but-unacked result is backpressure, not a retry request.
      # The next command waits so durable effects cannot be duplicated by silence.
      :blocked
    else
      case next_queued_command(player.id) do
        nil ->
          :blocked

        command ->
          command
          |> execute_command(player, now)
          |> then(&{:processed, &1})
      end
    end
  end

  defp execute_command(%GameCommand{} = command, %Player{} = player, now) do
    # The tuple captures the execution boundary: queue status, replayable client
    # payload, and the save slot affected by the command.
    {status, result, save_slot_id} =
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
            |> Ecto.Changeset.change(state: next_state, last_saved_at: now)
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

          if can_claim_in <= 100 do
            # Compute changes and apply state logic
            new_state =
              scheduled_state
              |> Bar.claim_reward()
              |> Bar.finalize_claim(now)

            updated_slot = Ecto.Changeset.change(active_slot, state: new_state, last_saved_at: now)
            Repo.update!(updated_slot)

            {"succeeded",
             %{
               "type" => "progress.claim_reward.result",
               "command_id" => command.command_id,
               "coins" => Map.get(new_state, "coins"),
               "exp" => Map.get(new_state, "exp"),
               "shards" => Map.get(new_state, "shards"),
               "cores" => Map.get(new_state, "cores")
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

    command
    |> GameCommand.changeset(%{
      status: status,
      result: result,
      save_slot_id: save_slot_id,
      processed_at: now
    })
    |> Repo.update!()
  end

  defp execute_switch(%Player{} = player, %GameCommand{} = command, now) do
    active_slot = active_slot(player, now)

    with {:ok, slot_index} <- fetch_slot_index(command.intent) do
      # Switching is a command because the current active slot is server truth.
      # The previous slot is saved before the active pointer moves.
      target_had_state = SaveSlots.get_slot!(player.id, slot_index).state |> is_map()
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

  defp insert_command(player_id, command_id, command_type, intent, now) do
    sequence = next_sequence(player_id)

    %GameCommand{}
    |> GameCommand.changeset(%{
      player_id: player_id,
      command_id: command_id,
      sequence: sequence,
      command_type: command_type,
      intent: intent,
      status: "queued",
      queued_at: now
    })
    |> Repo.insert!()
  end

  defp lock_player!(player_id) do
    Repo.one!(
      from player in Player,
        where: player.id == ^player_id,
        lock: "FOR UPDATE"
    )
  end

  defp active_slot(%Player{} = player, now) do
    # Commands such as slot switching can update the active pointer in this
    # transaction; reloading avoids using a stale struct for follow-up snapshots.
    player = Repo.get!(Player, player.id)
    SaveSlots.determine_active_slot(player, now)
  end

  defp current_unacked_command(player_id) do
    Repo.one(
      from command in GameCommand,
        where:
          command.player_id == ^player_id and command.status in ^@processed_statuses and
            is_nil(command.acked_at),
        order_by: [asc: command.sequence],
        limit: 1
    )
  end

  defp next_queued_command(player_id) do
    Repo.one(
      from command in GameCommand,
        where: command.player_id == ^player_id and command.status == "queued",
        order_by: [asc: command.sequence],
        limit: 1
    )
  end

  defp pending_command_by_client_id(player_id, command_id) do
    Repo.one(
      from command in GameCommand,
        where:
          command.player_id == ^player_id and command.command_id == ^command_id and
            is_nil(command.acked_at),
        limit: 1
    )
  end

  defp save_boundary_pending?(player_id) do
    Repo.exists?(
      from command in GameCommand,
        where:
          command.player_id == ^player_id and
            command.command_type in ["save_slot.switch", "save_slot.reset"] and
            command.status in ^@pending_statuses and is_nil(command.acked_at)
    )
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

  defp pending_command_count(player_id) do
    Repo.one(
      from command in GameCommand,
        where:
          command.player_id == ^player_id and command.status in ^@pending_statuses and
            is_nil(command.acked_at),
        select: count(command.id)
    )
  end

  defp next_sequence(player_id) do
    Repo.one(
      from command in GameCommand,
        where: command.player_id == ^player_id,
        select: max(command.sequence)
    )
    |> case do
      nil -> 1
      sequence -> sequence + 1
    end
  end

  defp fetch_slot_index(%{"slot_index" => slot_index}), do: normalize_slot_index(slot_index)
  defp fetch_slot_index(%{slot_index: slot_index}), do: normalize_slot_index(slot_index)
  defp fetch_slot_index(_intent), do: {:error, "slot_index_required"}

  defp normalize_slot_index(slot_index)
       when is_integer(slot_index) and slot_index in @slot_indexes do
    {:ok, slot_index}
  end

  defp normalize_slot_index(slot_index) when is_binary(slot_index) do
    with {integer, ""} <- Integer.parse(slot_index),
         true <- integer in @slot_indexes do
      {:ok, integer}
    else
      _ -> {:error, "invalid_slot_index"}
    end
  end

  defp normalize_slot_index(_slot_index), do: {:error, "invalid_slot_index"}

  defp normalize_intent(intent) when is_map(intent) do
    Map.new(intent, fn
      {key, value} when is_atom(key) -> {Atom.to_string(key), value}
      {key, value} -> {key, value}
    end)
  end

  defp normalize_intent(_intent), do: %{}

  defp extract_command_id(intent) do
    intent = normalize_intent(intent)

    case Map.pop(intent, "command_id") do
      {nil, _command_intent} ->
        :invalid_command_id

      {command_id, command_intent} ->
        with {:ok, command_id} <- normalize_command_id(command_id) do
          {:ok, command_id, command_intent}
        end
    end
  end

  defp normalize_command_id(command_id)
       when is_integer(command_id) and command_id in @command_id_slots do
    {:ok, command_id}
  end

  defp normalize_command_id(_command_id), do: :invalid_command_id

  defp cached_snapshot_hint?(%{"has_cached_snapshot" => true}), do: true
  defp cached_snapshot_hint?(%{has_cached_snapshot: true}), do: true
  defp cached_snapshot_hint?(_intent), do: false

  defp maybe_put_snapshot(result, _target_slot, _now, true), do: result

  defp maybe_put_snapshot(result, target_slot, now, false) do
    Map.put(result, "snapshot", Snapshots.full(target_slot, target_slot.slot_index, now))
  end

  defp command_result(%GameCommand{status: "queued"} = command), do: queued_result(command)

  defp command_result(%GameCommand{status: status} = command)
       when status in @processed_statuses do
    command.result
  end

  defp queued_result(%GameCommand{} = command) do
    %{
      "type" => "command.queued",
      "status" => "ok",
      "command_id" => command.command_id
    }
  end

  defp ack_result(command_id, released_result) do
    %{
      "type" => "command.ack.result",
      "status" => "ok",
      "command_id" => command_id,
      "released_result" => released_result
    }
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

  defp unwrap_transaction({:ok, value}), do: value
end
