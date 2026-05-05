defmodule Incrementalist.Game.Commands do
  @moduledoc """
  Executes gameplay commands through a durable, server-owned FIFO queue.

  Each command is inserted with a server-assigned sequence before any game rule
  runs. Once a command leaves `queued`, its `result` column is the durable wire
  response for that command. Reconnects and withheld acknowledgements return
  that stored result exactly, so rule execution remains once-only.

  The client never names the command being acknowledged. `command.ack` means
  "the current blocking result was applied", and the server decides which row
  that is from the player's queue.
  """

  import Ecto.Query

  alias Incrementalist.Game.Persistence.{GameCommand, Player, SaveSlots}
  alias Incrementalist.Game.{Snapshots, Time}
  alias Incrementalist.Repo

  @queue_limit 10
  @processed_statuses ["succeeded", "failed"]
  @pending_statuses ["queued" | @processed_statuses]
  @slot_indexes 0..3

  def enqueue(player_id, command_type, intent \\ %{}, now \\ Time.now())
      when is_binary(command_type) do
    Repo.transaction(fn ->
      # Locking the player row gives every queue mutation the same serialization point.
      # Without this, two sockets could both see an empty queue and execute out of order.
      player = lock_player!(player_id)

      if pending_command_count(player.id) >= @queue_limit do
        queue_full_result()
      else
        command = insert_command(player.id, command_type, normalize_intent(intent), now)

        case process_next_queued(player, now) do
          {:processed, processed_command} ->
            processed_command.result

          :blocked ->
            queued_result(command, pending_command_count(player.id))
        end
      end
    end)
    |> unwrap_transaction()
  end

  def ack(player_id, now \\ Time.now()) do
    Repo.transaction(fn ->
      player = lock_player!(player_id)

      case current_unacked_command(player.id) do
        nil ->
          %{
            "type" => "command.ack.result",
            "status" => "ok",
            "acked" => false,
            "released_result" => nil
          }

        command ->
          # Acknowledgement is intentionally implicit: the oldest processed,
          # unacked row is the only result the client is allowed to acknowledge.
          command
          |> GameCommand.changeset(%{status: "acked", acked_at: now})
          |> Repo.update!()

          released_result =
            case process_next_queued(player, now) do
              {:processed, next_command} -> next_command.result
              :blocked -> nil
            end

          %{
            "type" => "command.ack.result",
            "status" => "ok",
            "acked" => true,
            "released_result" => released_result
          }
      end
    end)
    |> unwrap_transaction()
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
             "server_time" => Time.iso8601(now),
             "events" => []
           }, active_slot.id}

        "save_slots.list" ->
          active_slot = active_slot(player, now)

          {"succeeded",
           %{
             "type" => "save_slots.list.result",
             "status" => "ok",
             "server_time" => Time.iso8601(now),
             "active_save_slot" => active_slot.slot_index,
             "slots" => SaveSlots.summaries(player.id, active_slot.slot_index)
           }, active_slot.id}

        "save_slot.switch" ->
          execute_switch(player, command.intent, now)

        "save_slot.reset" ->
          execute_reset(player, now)

        _unknown ->
          active_slot = active_slot(player, now)

          {"failed",
           error_result("unknown_command", %{
             "command_type" => command.command_type
           }), active_slot.id}
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

  defp execute_switch(%Player{} = player, intent, now) do
    active_slot = active_slot(player, now)

    with {:ok, slot_index} <- fetch_slot_index(intent) do
      # Switching is a command because the current active slot is server truth.
      # The previous slot is saved before the active pointer moves.
      target_had_state = SaveSlots.get_slot!(player.id, slot_index).state |> is_map()
      use_cached_snapshot = target_had_state and cached_snapshot_hint?(intent)
      target_slot = SaveSlots.switch_player_to_slot(player, slot_index, now)

      result =
        %{
          "type" => "save_slot.switch.result",
          "status" => "ok",
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
         error_result(reason, %{
           "active_save_slot" => active_slot.slot_index
         }), active_slot.id}
    end
  end

  defp execute_reset(%Player{} = player, now) do
    active_slot = active_slot(player, now)
    reset_slot = SaveSlots.reset(active_slot, now)

    {"succeeded",
     %{
       "type" => "save_slot.reset.result",
       "status" => "ok",
       "server_time" => Time.iso8601(now),
       "snapshot" => Snapshots.full(reset_slot, reset_slot.slot_index, now),
       "slots" => SaveSlots.summaries(player.id, reset_slot.slot_index)
     }, reset_slot.id}
  end

  defp insert_command(player_id, command_type, intent, now) do
    sequence = next_sequence(player_id)

    %GameCommand{}
    |> GameCommand.changeset(%{
      player_id: player_id,
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

  defp cached_snapshot_hint?(%{"has_cached_snapshot" => true}), do: true
  defp cached_snapshot_hint?(%{has_cached_snapshot: true}), do: true
  defp cached_snapshot_hint?(_intent), do: false

  defp maybe_put_snapshot(result, _target_slot, _now, true), do: result

  defp maybe_put_snapshot(result, target_slot, now, false) do
    Map.put(result, "snapshot", Snapshots.full(target_slot, target_slot.slot_index, now))
  end

  defp queued_result(%GameCommand{} = command, position) do
    %{
      "type" => "command.queued",
      "status" => "ok",
      "command_type" => command.command_type,
      "queue_position" => position
    }
  end

  defp queue_full_result do
    %{
      "type" => "command.rejected",
      "status" => "error",
      "reason" => "queue_full"
    }
  end

  defp error_result(reason, extra) do
    extra
    |> Map.merge(%{
      "type" => "command.error",
      "status" => "error",
      "reason" => reason
    })
  end

  defp unwrap_transaction({:ok, value}), do: value
end
