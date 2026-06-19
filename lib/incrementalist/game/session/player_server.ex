defmodule Incrementalist.Game.Session.PlayerServer do
  @moduledoc """
  Single source of truth for a player's live session mirror.

  The server owns in-memory command sequencing and keeps only completed command
  results for reconnect replay. Durable command rows are written as async audit
  side effects, while player state durability remains synchronous at save boundaries.
  """

  use GenServer, restart: :transient
  require Logger

  import Ecto.Query

  alias Incrementalist.Game.{CommandExecutor, Constants, Snapshots, State, Time}
  alias Incrementalist.Game.Features.Orchard.Soil, as: OrchardSoil
  alias Incrementalist.Game.Persistence.{GameCommand, Player, PlayerStates}
  alias Incrementalist.Game.Push.ClimateCache
  alias Incrementalist.Game.Session.PlayerSupervisor
  alias Incrementalist.Repo

  @idle_timeout :timer.minutes(10)
  @minute_ms 60_000
  @buffer_size 10
  @processed_statuses ["succeeded", "failed"]
  @reset_command_type "game.reset"
  @async_command_persistence Mix.env() != :test
  @pubsub Incrementalist.PubSub

  def start_link(player_id) do
    GenServer.start_link(__MODULE__, [player_id: player_id], name: via_tuple(player_id))
  end

  def via_tuple(player_id) do
    {:via, Registry, {Incrementalist.Game.Session.PlayerRegistry, player_id}}
  end

  def ensure_started(player_id) do
    PlayerSupervisor.ensure_started(player_id)
  end

  def boot_player(player_id, has_cached_snapshot \\ false, now \\ Time.now()) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:boot_player, has_cached_snapshot, now})
  end

  def enqueue(player_id, session_id, command_type, intent \\ %{}, now \\ Time.now()) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:enqueue, session_id, command_type, intent, now})
  end

  def ack(player_id, session_id, command_id, now \\ Time.now()) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:ack, session_id, command_id, now})
  end

  def replay_pending(player_id, last_known_sequence \\ nil) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:replay_pending, last_known_sequence})
  end

  def disconnect(player_id) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), :disconnect)
  end

  def reload_from_persistence(player_id, now \\ Time.now()) do
    case GenServer.whereis(via_tuple(player_id)) do
      nil -> :ok
      pid -> GenServer.call(pid, {:reload_from_persistence, now})
    end
  end

  def connect_channel(player_id, session_id, channel_pid \\ self()) do
    ensure_started(player_id)
    GenServer.call(via_tuple(player_id), {:connect_channel, session_id, channel_pid})
  end

  def disconnect_channel(player_id, channel_pid \\ self()) do
    case GenServer.whereis(via_tuple(player_id)) do
      nil -> :ok
      pid -> GenServer.call(pid, {:disconnect_channel, channel_pid})
    end
  end

  def player_push_topic(player_id), do: "game:player:#{player_id}"

  @impl true
  def init(player_id: player_id) do
    Process.flag(:trap_exit, true)

    state = %{
      player_id: player_id,
      player: nil,
      player_state: nil,
      idle_timer: Process.send_after(self(), :idle_timeout, @idle_timeout),
      player_tick_timer: nil,
      queued_commands: [],
      recent_commands: [],
      unacked_command: nil,
      sequence: 0,
      active_channel_pid: nil,
      active_session_id: nil,
      include_token_on_next_tick: true,
      last_pushed_has_bonustime_token: nil
    }

    {:ok, state, {:continue, :load_data}}
  end

  @impl true
  def handle_continue(:load_data, state) do
    {:noreply, refresh_session_state(state, Time.now())}
  end

  @impl true
  def handle_call({:boot_player, has_cached_snapshot, now}, _from, state) do
    state = refresh_player_and_state(state, now)
    player_state = state.player_state
    projected_state = player_state.state

    snapshot = if has_cached_snapshot, do: nil, else: Snapshots.full(player_state, now)
    has_bonustime_token = State.has_bonustime_token_available?(projected_state, now)

    bonustime_payload =
      if projected_state.bonustime do
        Map.merge(Map.from_struct(projected_state.bonustime), %{
          "active_game_id" =>
            Incrementalist.Game.Features.BonusTime.Rules.get_active_game_id(now)
        })
      else
        nil
      end

    boot = %{
      "type" => "game.boot",
      "username" => state.player.username,
      "server_time" => Time.iso8601(now),
      "idle_mode" => projected_state.idle_mode || false,
      "projection_params" => Incrementalist.Game.State.projection_params(projected_state, now),
      "snapshot" => snapshot,
      "pending_result" => pending_result(state, nil),
      "has_bonustime_token" => has_bonustime_token,
      "bonustime" => bonustime_payload
    }

    boot =
      if has_cached_snapshot do
        boot
        |> Map.put("plots", Incrementalist.Game.State.visible_plots(projected_state.plots))
        |> Map.put("soil", OrchardSoil.visible_state(projected_state.soil))
        |> Map.put("climate", ClimateCache.visible_state(now))
      else
        boot
      end

    next_state =
      state
      |> Map.put(:include_token_on_next_tick, true)
      |> Map.put(:last_pushed_has_bonustime_token, has_bonustime_token)

    {:reply, boot, next_state}
  end

  @impl true
  def handle_call({:replay_pending, last_known_sequence}, _from, state) do
    {result, next_state} = pending_result_with_state(state, last_known_sequence)
    {:reply, result, next_state}
  end

  @impl true
  def handle_call({:connect_channel, session_id, channel_pid}, _from, state) do
    if state.active_channel_pid && state.active_channel_pid != channel_pid do
      send(state.active_channel_pid, {:superseded, session_id})
    end

    next_state =
      if is_nil(state.active_channel_pid) do
        state
        |> Map.put(:active_channel_pid, channel_pid)
        |> Map.put(:active_session_id, session_id)
        |> Map.put(:include_token_on_next_tick, true)
        |> Map.put(:last_pushed_has_bonustime_token, nil)
        |> schedule_next_player_tick(Time.to_unix_ms(Time.now()))
      else
        %{state | active_channel_pid: channel_pid, active_session_id: session_id}
      end

    {:reply, :ok, next_state}
  end

  @impl true
  def handle_call({:disconnect_channel, channel_pid}, _from, state) do
    if state.active_channel_pid == channel_pid do
      save_player_state(state)

      next_state =
        state
        |> cancel_player_tick_timer()
        |> Map.put(:player_state, nil)
        |> Map.put(:active_channel_pid, nil)
        |> Map.put(:active_session_id, nil)
        |> Map.put(:include_token_on_next_tick, true)
        |> Map.put(:last_pushed_has_bonustime_token, nil)

      {:stop, :normal, :ok, next_state}
    else
      {:reply, :ok, state}
    end
  end

  @impl true
  def handle_call(:disconnect, _from, state) do
    save_player_state(state)

    next_state =
      state
      |> cancel_player_tick_timer()
      |> Map.put(:player_state, nil)

    {:stop, :normal, :ok, next_state}
  end

  @impl true
  def handle_call({:reload_from_persistence, now}, _from, state) do
    {:reply, :ok, refresh_player_and_state(state, now)}
  end

  @impl true
  def handle_call({:enqueue, session_id, command_type, intent, now}, _from, state) do
    if session_id != state.active_session_id do
      {:reply, %{"type" => "command.error", "status" => "error", "reason" => "session_superseded", "command_id" => get_command_id_or_zero(intent)}, state}
    else
    case extract_command_id(intent) do
      {:ok, command_id, command_intent} ->
        case existing_pending_by_command_id(state, command_id) do
          {:unacked, command} ->
            {result, next_state} = replay_unacked(state, command)
            {:reply, result, next_state}

          {:queued, _command} ->
            {:reply, queued_result(command_id), state}

          :none ->
            if queue_full?(state) or reset_pending?(state) do
              {:reply, :queue_full, state}
            else
              {command, next_state} =
                build_command(state, command_type, command_id, command_intent, now)

              if can_execute_immediately?(state) do
                {result, released_state} = execute_next(next_state, command, now)
                {:reply, result, released_state}
              else
                queued_state = enqueue_in_memory(next_state, command)
                {:reply, queued_result(command_id), queued_state}
              end
            end
        end

      _error ->
        {:reply, :invalid_command_id, state}
    end
    end
  end

  @impl true
  def handle_call({:ack, session_id, command_id, now}, _from, state) do
    if session_id != state.active_session_id do
      {:reply, %{"type" => "command.error", "status" => "error", "reason" => "session_superseded", "command_id" => command_id}, state}
    else
    case normalize_command_id(command_id) do
      {:ok, valid_id} ->
        case state.unacked_command do
          %GameCommand{command_id: ^valid_id} = command ->
            async_mark_command_acked(command, now)

            recent = push_recent(state.recent_commands, command)
            next_after_ack = %{state | unacked_command: nil, recent_commands: recent}

            {released_result, next_state} = process_next_queued(next_after_ack, now)

            {:reply, ack_result(valid_id, released_result), next_state}

          _not_current ->
            {:reply, ack_result(valid_id, nil), state}
        end

      _error ->
        {:reply, :invalid_command_id, state}
    end
    end
  end

  @impl true
  def handle_info(:idle_timeout, state) do
    if not is_nil(state.active_channel_pid) do
      {:noreply, %{state | idle_timer: Process.send_after(self(), :idle_timeout, @idle_timeout)}}
    else
      Logger.info("PlayerServer #{state.player_id} shutting down due to idle timeout")
      save_player_state(state)
      {:stop, :normal, %{state | player_state: nil}}
    end
  end

  @impl true
  def handle_info({:persist_completed_command, attrs}, state) do
    persist_completed_command!(attrs)

    {:noreply, state}
  end

  @impl true
  def handle_info({:mark_command_acked, attrs, now}, state) do
    mark_command_acked!(attrs, now)

    {:noreply, state}
  end

  @impl true
  def handle_info({:upsert_replay_count, attrs}, state) do
    upsert_replay_count!(attrs)

    {:noreply, state}
  end

  @impl true
  def handle_info({:emit_player_tick, boundary_ms}, state) do
    boundary_time = DateTime.from_unix!(boundary_ms, :millisecond)
    state = %{state | player_tick_timer: nil}

    if is_nil(state.active_channel_pid) do
      {:noreply, state}
    else
      {payload, next_state} = player_tick_payload_with_state(state, boundary_time)

      Phoenix.PubSub.broadcast(
        @pubsub,
        player_push_topic(state.player_id),
        {:player_tick, payload}
      )

      {:noreply, schedule_next_player_tick(next_state, Time.to_unix_ms(Time.now()))}
    end
  end

  @impl true
  def terminate(reason, state) do
    Logger.info("PlayerServer #{state.player_id} terminating, reason: #{inspect(reason)}")
    save_player_state(state)
  end

  defp refresh_session_state(state, now) do
    player = Repo.get!(Player, state.player_id)
    player_state = PlayerStates.load_or_create(player, now)
    current_unacked = current_unacked_command(state.player_id)

    recent_commands =
      update_recent_commands(state.recent_commands, state.unacked_command, current_unacked)

    sequence =
      if state.sequence > 0 do
        state.sequence
      else
        latest_sequence(state.player_id)
      end

    %{
      state
      | player: player,
        player_state: player_state,
        queued_commands: [],
        recent_commands: recent_commands,
        unacked_command: current_unacked,
        sequence: sequence
    }
  end

  defp build_command(state, command_type, command_id, command_intent, now) do
    sequence = state.sequence + 1

    command = %GameCommand{
      player_id: state.player_id,
      command_id: command_id,
      sequence: sequence,
      command_type: command_type,
      intent: command_intent,
      status: "queued",
      queued_at: now
    }

    {command, %{state | sequence: sequence}}
  end

  defp enqueue_in_memory(state, command) do
    %{state | queued_commands: state.queued_commands ++ [command]}
  end

  defp execute_next(state, command, now) do
    {status, result, ps_id} = CommandExecutor.execute(command, state.player, now)
    refreshed_state = refresh_player_and_state(state, now)

    player_state =
      if(refreshed_state.player_state, do: refreshed_state.player_state.state, else: nil)

    result = attach_runtime_sync_fields(result, now, player_state)

    completed = %{
      command
      | status: status,
        result: result,
        processed_at: now,
        player_state_id: ps_id
    }

    async_persist_completed_command(completed)

    {result, %{refreshed_state | unacked_command: completed}}
  end

  defp attach_runtime_sync_fields(result, now, %State{}) when is_map(result) do
    Map.put_new(result, "server_time", Time.iso8601(now))
  end

  defp attach_runtime_sync_fields(result, _now, _player_state), do: result

  defp player_tick_payload_with_state(state, %DateTime{} = now) do
    current_player_state = state.player_state || PlayerStates.load_or_create(state.player, now)

    projected_state =
      current_player_state.state
      |> State.check_daily_reset(now)
      |> OrchardSoil.project_state(now)

    has_bonustime_token = State.has_bonustime_token_available?(projected_state, now)

    include_token? =
      state.include_token_on_next_tick or
        state.last_pushed_has_bonustime_token != has_bonustime_token

    payload =
      %{
        "type" => "player.tick",
        "server_time" => Time.iso8601(now),
        "climate" => ClimateCache.visible_state(now),
        "soil" => OrchardSoil.visible_state(projected_state.soil),
        "plots" => Incrementalist.Game.State.visible_plots(projected_state.plots)
      }
      |> maybe_put_bonustime_token(has_bonustime_token, include_token?)

    next_state =
      state
      |> Map.put(:player_state, %{current_player_state | state: projected_state})
      |> Map.put(:include_token_on_next_tick, false)
      |> Map.put(:last_pushed_has_bonustime_token, has_bonustime_token)

    {payload, next_state}
  end

  defp maybe_put_bonustime_token(payload, token_value, true),
    do: Map.put(payload, "has_bonustime_token", token_value)

  defp maybe_put_bonustime_token(payload, _token_value, false), do: payload

  defp next_minute_boundary_ms(now_ms) when is_integer(now_ms) do
    (div(now_ms, @minute_ms) + 1) * @minute_ms
  end

  defp schedule_next_player_tick(state, now_ms) do
    state = cancel_player_tick_timer(state)
    boundary_ms = next_minute_boundary_ms(now_ms)
    delay_ms = max(1, boundary_ms - now_ms)
    timer_ref = Process.send_after(self(), {:emit_player_tick, boundary_ms}, delay_ms)
    %{state | player_tick_timer: timer_ref}
  end

  defp cancel_player_tick_timer(%{player_tick_timer: nil} = state), do: state

  defp cancel_player_tick_timer(%{player_tick_timer: timer_ref} = state) do
    Process.cancel_timer(timer_ref)
    %{state | player_tick_timer: nil}
  end

  defp process_next_queued(state, now) do
    case state.queued_commands do
      [] ->
        {nil, state}

      [next | rest] ->
        state = %{state | queued_commands: rest}
        execute_next(state, next, now)
    end
  end

  defp replay_unacked(state, command) do
    replayed = bump_replay_count(command)
    {replayed.result, %{state | unacked_command: replayed}}
  end

  defp pending_result(%{unacked_command: nil}, nil), do: nil

  defp pending_result(%{unacked_command: nil} = state, last_known_sequence)
       when is_integer(last_known_sequence) do
    latest_buffered_result(state, last_known_sequence)
  end

  defp pending_result(%{unacked_command: command}, nil), do: command.result

  defp pending_result(%{unacked_command: command} = state, last_known_sequence)
       when is_integer(last_known_sequence) do
    if command.sequence > last_known_sequence do
      command.result
    else
      latest_buffered_result(state, last_known_sequence)
    end
  end

  defp pending_result(_state, _last_known_sequence), do: nil

  defp pending_result_with_state(%{unacked_command: nil} = state, last_known_sequence) do
    case latest_buffered_command(state, last_known_sequence) do
      nil ->
        {nil, state}

      replayed ->
        {replayed.result, put_recent_command(state, replayed)}
    end
  end

  defp pending_result_with_state(%{unacked_command: command} = state, last_known_sequence)
       when is_integer(last_known_sequence) do
    if command.sequence > last_known_sequence do
      replayed = bump_replay_count(command)
      {replayed.result, %{state | unacked_command: replayed}}
    else
      pending_result_with_state(%{state | unacked_command: nil}, last_known_sequence)
      |> case do
        {result, next_state} -> {result, %{next_state | unacked_command: command}}
      end
    end
  end

  defp pending_result_with_state(%{unacked_command: command} = state, _last_known_sequence) do
    replayed = bump_replay_count(command)
    {replayed.result, %{state | unacked_command: replayed}}
  end

  defp latest_buffered_result(state, last_known_sequence) do
    case latest_buffered_command(state, last_known_sequence) do
      nil -> nil
      command -> command.result
    end
  end

  defp latest_buffered_command(state, last_known_sequence) do
    if is_integer(last_known_sequence) do
      state.recent_commands
      |> Enum.filter(&(&1.sequence > last_known_sequence))
      |> Enum.sort_by(& &1.sequence)
      |> List.first()
      |> case do
        nil -> nil
        command -> bump_replay_count(command)
      end
    else
      nil
    end
  end

  defp put_recent_command(state, replayed) do
    recent =
      Enum.map(state.recent_commands, fn command ->
        if command.sequence == replayed.sequence, do: replayed, else: command
      end)

    %{state | recent_commands: recent}
  end

  defp existing_pending_by_command_id(state, command_id) do
    cond do
      state.unacked_command && state.unacked_command.command_id == command_id ->
        {:unacked, state.unacked_command}

      Enum.any?(state.queued_commands, &(&1.command_id == command_id)) ->
        {:queued, :queued}

      true ->
        :none
    end
  end

  defp queue_full?(state) do
    pending_count = length(state.queued_commands) + if(state.unacked_command, do: 1, else: 0)
    pending_count >= Constants.max_queued_commands()
  end

  defp can_execute_immediately?(state) do
    is_nil(state.unacked_command) and Enum.empty?(state.queued_commands)
  end

  defp reset_pending?(state) do
    pending_commands = [state.unacked_command | state.queued_commands]

    Enum.any?(pending_commands, fn
      nil -> false
      command -> command.command_type == @reset_command_type
    end)
  end

  defp ack_result(command_id, released_result) do
    %{
      "type" => "command.ack.result",
      "status" => "ok",
      "command_id" => command_id,
      "released_result" => released_result
    }
  end

  defp refresh_player_and_state(state, now) do
    player = Repo.get!(Player, state.player_id)
    player_state = PlayerStates.load_or_create(player, now)
    %{state | player: player, player_state: player_state}
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

  defp save_player_state(%{player_state: nil}), do: :ok

  defp save_player_state(%{player_state: player_state}) do
    PlayerStates.autosave(player_state)
    :ok
  end

  defp async_persist_completed_command(command) do
    attrs = command_attrs(command)

    if @async_command_persistence do
      send(self(), {:persist_completed_command, attrs})
    else
      persist_completed_command!(attrs)
    end
  end

  defp async_mark_command_acked(command, now) do
    acked_attrs =
      command
      |> command_attrs()
      |> Map.merge(%{status: "acked", acked_at: now, updated_at: now})

    if @async_command_persistence do
      send(self(), {:mark_command_acked, acked_attrs, now})
    else
      mark_command_acked!(acked_attrs, now)
    end
  end

  defp bump_replay_count(command) do
    replayed = %{command | replay_count: (command.replay_count || 0) + 1}
    async_upsert_replay_count(replayed)
    replayed
  end

  defp async_upsert_replay_count(command) do
    replay_attrs =
      command
      |> command_attrs()
      |> Map.merge(%{updated_at: Time.now()})

    if @async_command_persistence do
      send(self(), {:upsert_replay_count, replay_attrs})
    else
      upsert_replay_count!(replay_attrs)
    end
  end

  defp persist_completed_command!(attrs) do
    %GameCommand{}
    |> GameCommand.changeset(attrs)
    |> Repo.insert!(on_conflict: :nothing, conflict_target: [:player_id, :sequence])
  end

  defp mark_command_acked!(attrs, now) do
    Repo.insert!(
      GameCommand.changeset(%GameCommand{}, attrs),
      on_conflict: [set: [status: "acked", acked_at: now, updated_at: now]],
      conflict_target: [:player_id, :sequence]
    )
  end

  defp upsert_replay_count!(attrs) do
    Repo.insert!(
      GameCommand.changeset(%GameCommand{}, attrs),
      on_conflict: [set: [replay_count: attrs.replay_count, updated_at: attrs.updated_at]],
      conflict_target: [:player_id, :sequence]
    )
  end

  defp command_attrs(command) do
    %{
      player_id: command.player_id,
      player_state_id: command.player_state_id,
      command_id: command.command_id,
      sequence: command.sequence,
      command_type: command.command_type,
      intent: command.intent || %{},
      status: command.status,
      result: command.result,
      queued_at: command.queued_at,
      processed_at: command.processed_at,
      acked_at: command.acked_at,
      replay_count: command.replay_count || 0,
      inserted_at: command.inserted_at || command.queued_at || Time.now(),
      updated_at: Time.now()
    }
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

  defp queued_result(command_id) do
    %{"type" => "command.queued", "status" => "ok", "command_id" => command_id}
  end

  defp get_command_id_or_zero(intent) do
    case extract_command_id(intent) do
      {:ok, id, _} -> id
      _ -> 0
    end
  end
end
