defmodule Incrementalist.Game.Session.PlayerServer do
  @moduledoc """
  Single source of truth for a player's session.
  Holds active save file data in-memory to serve gameplay requests instantly.
  """
  use GenServer, restart: :transient
  require Logger

  alias Incrementalist.Game.Persistence.{Player, SaveSlots, GameCommand}
  alias Incrementalist.Game.{CommandExecutor, Time, Constants}
  alias Incrementalist.Repo
  import Ecto.Query

  @idle_timeout :timer.minutes(10)
  @buffer_size 10

  def start_link(player_id) do
    name = via_tuple(player_id)
    GenServer.start_link(__MODULE__, [player_id: player_id], name: name)
  end

  def via_tuple(player_id) do
    {:via, Registry, {Incrementalist.Game.Session.PlayerRegistry, player_id}}
  end

  @impl true
  def init(player_id: player_id) do
    Process.flag(:trap_exit, true)
    timer = Process.send_after(self(), :idle_timeout, @idle_timeout)

    state = %{
      player_id: player_id,
      player: nil,
      active_slot: nil,
      idle_timer: timer,
      recent_commands: [],
      unacked_command: nil,
      sequence: 0
    }

    {:ok, state, {:continue, :load_data}}
  end

  @impl true
  def handle_continue(:load_data, state) do
    now = Time.now()
    player = Repo.get!(Player, state.player_id)
    active_slot = SaveSlots.determine_active_slot(player, now)

    # Preload latest sequence
    seq = Repo.one(from c in GameCommand, where: c.player_id == ^state.player_id, select: max(c.sequence)) || 0

    # Unacked command (if the server crashed or was restarted)
    unacked = Repo.one(
      from command in GameCommand,
        where:
          command.player_id == ^state.player_id and command.status in ["succeeded", "failed"] and
            is_nil(command.acked_at),
        order_by: [asc: command.sequence],
        limit: 1
    )

    new_state = %{state | player: player, active_slot: active_slot, sequence: seq, unacked_command: unacked}
    {:noreply, new_state}
  end

  @impl true
  def handle_info(:idle_timeout, state) do
    Logger.info("PlayerServer #{state.player_id} shutting down due to idle timeout")
    {:stop, :normal, state}
  end

  @impl true
  def terminate(reason, state) do
    Logger.info("PlayerServer #{state.player_id} terminating, reason: #{inspect(reason)}")
    save_active_slot(state)
  end

  defp save_active_slot(%{active_slot: nil}), do: :ok
  defp save_active_slot(%{active_slot: active_slot}) do
    SaveSlots.autosave(active_slot)
    :ok
  end

  @impl true
  def handle_cast(:disconnect, state) do
    save_active_slot(state)
    {:stop, :normal, state}
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

  # --- Commands API ---

  @impl true
  def handle_call({:enqueue, command_type, intent}, _from, state) do
    now = Time.now()
    case extract_command_id(intent) do
      {:ok, command_id, command_intent} ->
        if state.unacked_command != nil do
          if state.unacked_command.command_id == command_id do
            # Replay
            {:reply, state.unacked_command.result, state}
          else
            # Blocked waiting for ack
            {:reply, %{"type" => "command.queued", "status" => "ok", "command_id" => command_id}, state}
          end
        else
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

          # Async persistence
          cmd_to_insert = %{cmd | status: status, result: result, processed_at: now, save_slot_id: slot_id}
          async_persist_command(cmd_to_insert)

          # Add to unacked
          unacked = %{cmd_to_insert | result: result}

          # Update memory slot
          updated_slot = if slot_id == state.active_slot.id do
             Repo.get!(SaveSlot, slot_id)
          else
            state.active_slot
          end

          new_state = %{state | sequence: seq, unacked_command: unacked, active_slot: updated_slot}
          {:reply, result, new_state}
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
          # Acknowledge
          cmd_to_update = state.unacked_command
          async_ack_command(cmd_to_update.player_id, cmd_to_update.sequence, now)

          # Save to buffer
          recent = Enum.take([cmd_to_update | state.recent_commands], @buffer_size)

          new_state = %{state | unacked_command: nil, recent_commands: recent}
          {:reply, %{"type" => "command.ack.result", "status" => "ok", "command_id" => valid_id, "released_result" => nil}, new_state}
        else
          {:reply, %{"type" => "command.ack.result", "status" => "ok", "command_id" => valid_id, "released_result" => nil}, state}
        end
      _error ->
        {:reply, :invalid_command_id, state}
    end
  end

  @impl true
  def handle_call(:replay_pending, _from, state) do
    result = if state.unacked_command do
      state.unacked_command.result
    else
      nil
    end
    {:reply, result, state}
  end

  defp extract_command_id(intent) do
    intent = normalize_intent(intent)
    case Map.pop(intent, "command_id") do
      {nil, _} -> :invalid_command_id
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

  defp normalize_command_id(command_id) when is_integer(command_id) do
    if command_id in Constants.valid_command_ids() do
      {:ok, command_id}
    else
      :invalid_command_id
    end
  end
  defp normalize_command_id(_), do: :invalid_command_id

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
end
