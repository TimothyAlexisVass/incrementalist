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

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.CommandExecutor
  alias Incrementalist.Game.Persistence.{GameCommand, Player}
  alias Incrementalist.Game.Session.PlayerServer
  alias Incrementalist.Game.Time
  alias Incrementalist.Repo

  @processed_statuses ["succeeded", "failed"]
  @pending_statuses ["queued" | @processed_statuses]

  def enqueue(player_id, command_type, intent \\ %{}, now \\ Time.now()) do
    with {:ok, command_id, command_intent} <- extract_command_id(intent) do
      result =
        Repo.transaction(fn ->
        # Locking the player row gives every queue mutation the same serialization point.
        # Without this, two sockets could both see an empty queue and execute out of order.
        player = lock_player!(player_id)

        case pending_command_by_client_id(player.id, command_id) do
          %GameCommand{} = command ->
            command_result(command)

          nil ->
            if save_boundary_pending?(player.id) or
                 pending_command_count(player.id) >= Constants.max_queued_commands() do
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

      maybe_sync_player_session(player_id, result)
      result
    end
  end

  def ack(player_id, command_id, now \\ Time.now()) do
    with {:ok, command_id} <- normalize_command_id(command_id) do
      result =
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

      maybe_sync_player_session(player_id, result)
      result
    end
  end

  def replay_pending(player_id, last_known_sequence \\ nil) do
    PlayerServer.replay_pending(player_id, last_known_sequence)
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
          {status, result, save_slot_id} = CommandExecutor.execute(command, player, now)

          command
          |> GameCommand.changeset(%{
            status: status,
            result: result,
            save_slot_id: save_slot_id,
            processed_at: now
          })
          |> Repo.update!()
          |> then(&{:processed, &1})
      end
    end
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
       when is_integer(command_id) do
    if command_id in Constants.valid_command_ids() do
      {:ok, command_id}
    else
      :invalid_command_id
    end
  end

  defp normalize_command_id(_command_id), do: :invalid_command_id

  defp command_result(%GameCommand{status: "queued"} = command), do: queued_result(command)

  defp command_result(%GameCommand{status: status} = command)
       when status in @processed_statuses do
    command.result
  end

  defp maybe_sync_player_session(_player_id, result) when result in [:queue_full, :invalid_command_id],
    do: :ok

  defp maybe_sync_player_session(player_id, _result) do
    PlayerServer.sync_from_db(player_id)
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

  defp unwrap_transaction({:ok, value}), do: value
end
