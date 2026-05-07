defmodule Incrementalist.Game.Session.PlayerServer do
  @moduledoc """
  Single source of truth for a player's live session mirror.

  The server keeps the active save slot and the most recent completed command
  results in memory so reconnects can resume without rereading the database.
  """

  use GenServer, restart: :transient
  require Logger

  import Ecto.Query

  alias Incrementalist.Game.{CommandExecutor, Constants, Snapshots, Time}
  alias Incrementalist.Game.Persistence.{GameCommand, Player, SaveSlot, SaveSlots}
  alias Incrementalist.Game.Session.PlayerSupervisor
  alias Incrementalist.Repo

  @idle_timeout :timer.minutes(10)
  @buffer_size 10
  @processed_statuses ["succeeded", "failed"]

  def start_link(player_id) do
    GenServer.start_link(__MODULE__, [player_id: player_id], name: via_tuple(player_id))
  end

  def via_tuple(player_id) do
    {:via, Registry, {Incrementalist.Game.Session.PlayerRegistry, player_id}}
  end

  def ensure_started(player_id) do
    PlayerSupervisor.ensure_started(player_id)
  end

  def boot_player(player_id, cached_save_slots \\ MapSet.new(), now \\ Time.now()) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:boot_player, cached_save_slots, now})
  end

  def sync_from_db(player_id, now \\ Time.now()) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:sync_from_db, now})
  end

  def replay_pending(player_id, last_known_sequence \\ nil) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:replay_pending, last_known_sequence})
  end

  def disconnect(player_id) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), :disconnect)
  end

  @impl true
  def init(player_id: player_id) do
    Process.flag(:trap_exit, true)

    state = %{
      player_id: player_id,
      player: nil,
      active_slot: nil,
      idle_timer: Process.send_after(self(), :idle_timeout, @idle_timeout),
      recent_commands: [],
      unacked_command: nil,
      sequence: 0
    }

    {:ok, state, {:continue, :load_data}}
  end

  @impl true
  def handle_continue(:load_data, state) do
    {:noreply, refresh_session_state(state, Time.now())}
  end

  @impl true
  def handle_call({:boot_player, cached_save_slots, now}, _from, state) do
    active_slot = state.active_slot || SaveSlots.determine_active_slot(state.player, now)
    snapshot = snapshot_unless_cached(active_slot, cached_save_slots, now)

    boot = %{
      "type" => "game.boot",
      "username" => state.player.username,
      "active_save_slot" => active_slot.slot_index,
      "save_slot" => Incrementalist.Game.State.summary(active_slot, active_slot.slot_index),
      "snapshot" => snapshot,
      "pending_result" => pending_result(state, nil)
    }

    {:reply, boot, state}
  end

  @impl true
  def handle_call({:sync_from_db, now}, _from, state) do
    {:reply, :ok, refresh_session_state(state, now)}
  end

  @impl true
  def handle_call({:replay_pending, last_known_sequence}, _from, state) do
    {:reply, pending_result(state, last_known_sequence), state}
  end

  @impl true
  def handle_call(:disconnect, _from, state) do
    save_active_slot(state)
    {:stop, :normal, :ok, %{state | active_slot: nil}}
  end

  @impl true
  def handle_call({:switch_slot, target_index}, _from, state) do
    now = Time.now()
    new_slot = SaveSlots.switch_player_to_slot(state.player, target_index, now)
    player = Repo.get!(Player, state.player_id)

    new_state = %{state | active_slot: new_slot, player: player}
    {:reply, {:ok, new_slot}, new_state}
  end

  @impl true
  def handle_call(:reset_slot, _from, state) do
    now = Time.now()
    new_slot = SaveSlots.reset(state.active_slot, now)
    new_state = %{state | active_slot: new_slot}
    {:reply, {:ok, new_slot}, new_state}
  end

  @impl true
  def handle_call({:enqueue, command_type, intent}, _from, state) do
    now = Time.now()

    case extract_command_id(intent) do
      {:ok, command_id, command_intent} ->
        case state.unacked_command do
          %GameCommand{command_id: ^command_id} ->
            {:reply, state.unacked_command.result, state}

          nil ->
            case recent_command_by_id(state, command_id) do
              nil ->
                seq = state.sequence + 1

                cmd = %GameCommand{
                  player_id: state.player_id,
                  command_id: command_id,
                  sequence: seq,
                  command_type: command_type,
                  intent: command_intent,
                  status: "queued",
                  queued_at: now
                }

                {status, result, slot_id} = CommandExecutor.execute(cmd, state.player, now)

                cmd_to_insert = %{cmd | status: status, result: result, processed_at: now, save_slot_id: slot_id}
                async_persist_command(cmd_to_insert)

                updated_slot =
                  if state.active_slot && slot_id == state.active_slot.id do
                    Repo.get!(SaveSlot, slot_id)
                  else
                    state.active_slot
                  end

                new_state = %{state | sequence: seq, unacked_command: cmd_to_insert, active_slot: updated_slot}

                {:reply, result, new_state}

              recent_command ->
                {:reply, replay_command(recent_command), state}
            end

          _other ->
            {:reply, queued_result(command_id), state}
        end

      _error ->
        {:reply, :invalid_command_id, state}
    end
  end

  @impl true
  def handle_call({:ack, command_id}, _from, state) do
    now = Time.now()

    case normalize_command_id(command_id) do
      {:ok, valid_id} ->
        if state.unacked_command && state.unacked_command.command_id == valid_id do
          cmd_to_update = state.unacked_command
          async_ack_command(cmd_to_update.player_id, cmd_to_update.sequence, now)

          recent = push_recent(state.recent_commands, cmd_to_update)

          new_state = %{state | unacked_command: nil, recent_commands: recent}

          {:reply,
           %{
             "type" => "command.ack.result",
             "status" => "ok",
             "command_id" => valid_id,
             "released_result" => nil
           }, new_state}
        else
          {:reply,
           %{
             "type" => "command.ack.result",
             "status" => "ok",
             "command_id" => valid_id,
             "released_result" => nil
           }, state}
        end

      _error ->
        {:reply, :invalid_command_id, state}
    end
  end

  @impl true
  def handle_info(:idle_timeout, state) do
    Logger.info("PlayerServer #{state.player_id} shutting down due to idle timeout")
    save_active_slot(state)
    {:stop, :normal, %{state | active_slot: nil}}
  end

  @impl true
  def terminate(reason, state) do
    Logger.info("PlayerServer #{state.player_id} terminating, reason: #{inspect(reason)}")
    save_active_slot(state)
  end

  defp refresh_session_state(state, now) do
    player = Repo.get!(Player, state.player_id)
    active_slot = SaveSlots.determine_active_slot(player, now)
    current_unacked = current_unacked_command(state.player_id)
    recent_commands = update_recent_commands(state.recent_commands, state.unacked_command, current_unacked)
    sequence = latest_sequence(state.player_id)

    %{state | player: Repo.get!(Player, state.player_id), active_slot: active_slot, recent_commands: recent_commands, unacked_command: current_unacked, sequence: sequence}
  end

  defp update_recent_commands(recent_commands, previous_unacked, current_unacked) do
    recent_commands =
      if completed_command?(previous_unacked, current_unacked) do
        push_recent(recent_commands, previous_unacked)
      else
        recent_commands
      end

    recent_commands
    |> Enum.reject(&is_nil(&1))
    |> Enum.uniq_by(& &1.sequence)
    |> Enum.take(@buffer_size)
  end

  defp completed_command?(nil, _current_unacked), do: false
  defp completed_command?(_previous_unacked, nil), do: true
  defp completed_command?(previous_unacked, current_unacked),
    do: previous_unacked.sequence != current_unacked.sequence

  defp push_recent(recent_commands, command) when is_nil(command), do: recent_commands

  defp push_recent(recent_commands, command) do
    [command | recent_commands]
    |> Enum.uniq_by(& &1.sequence)
    |> Enum.take(@buffer_size)
  end

  defp recent_command_by_id(state, command_id) do
    Enum.find(state.recent_commands, &(&1.command_id == command_id))
  end

  defp pending_result(%{unacked_command: nil}, nil), do: nil

  defp pending_result(%{unacked_command: nil} = state, last_known_sequence)
       when is_integer(last_known_sequence) do
    latest_buffered_result(state, last_known_sequence)
  end

  defp pending_result(%{unacked_command: command}, nil), do: replay_command(command)

  defp pending_result(%{unacked_command: command} = state, last_known_sequence)
       when is_integer(last_known_sequence) do
    cond do
      command.sequence > last_known_sequence ->
        replay_command(command)

      true ->
        latest_buffered_result(state, last_known_sequence)
    end
  end

  defp pending_result(_state, _last_known_sequence), do: nil

  defp latest_buffered_result(state, last_known_sequence) do
    state.recent_commands
    |> Enum.filter(&(&1.sequence > last_known_sequence))
    |> Enum.sort_by(& &1.sequence)
    |> case do
      [next_command | _] -> replay_command(next_command)
      [] -> nil
    end
  end

  defp snapshot_unless_cached(active_slot, cached_save_slots, now) do
    if MapSet.member?(cached_save_slots, active_slot.slot_index) do
      nil
    else
      Snapshots.full(active_slot, active_slot.slot_index, now)
    end
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

  defp latest_sequence(player_id) do
    Repo.one(
      from c in GameCommand,
        where: c.player_id == ^player_id,
        select: max(c.sequence)
    ) || 0
  end

  defp save_active_slot(%{active_slot: nil}), do: :ok

  defp save_active_slot(%{active_slot: active_slot}) do
    SaveSlots.autosave(active_slot)
    :ok
  end

  defp async_persist_command(cmd) do
    Task.start(fn ->
      %GameCommand{}
      |> GameCommand.changeset(Map.from_struct(cmd))
      |> Repo.insert!()
    end)
  end

  defp async_ack_command(player_id, sequence, now) do
    Task.start(fn ->
      Repo.update_all(
        from(c in GameCommand, where: c.player_id == ^player_id and c.sequence == ^sequence),
        set: [status: "acked", acked_at: now]
      )
    end)
  end

  defp replay_command(%GameCommand{} = command) do
    Repo.update_all(
      from(c in GameCommand, where: c.id == ^command.id),
      inc: [replay_count: 1]
    )

    command.result
  end

  defp normalize_command_id(command_id) when is_integer(command_id) do
    if command_id in Constants.valid_command_ids() do
      {:ok, command_id}
    else
      :invalid_command_id
    end
  end

  defp normalize_command_id(_), do: :invalid_command_id

  defp extract_command_id(intent) do
    intent = normalize_intent(intent)

    case Map.pop(intent, "command_id") do
      {nil, _} ->
        :invalid_command_id

      {command_id, command_intent} ->
        with {:ok, valid_id} <- normalize_command_id(command_id) do
          {:ok, valid_id, command_intent}
        end
    end
  end

  defp normalize_intent(intent) when is_map(intent) do
    Map.new(intent, fn
      {key, value} when is_atom(key) -> {Atom.to_string(key), value}
      {key, value} -> {key, value}
    end)
  end

  defp normalize_intent(_intent), do: %{}

  defp queued_result(command_id) do
    %{"type" => "command.queued", "status" => "ok", "command_id" => command_id}
  end
end
