defmodule Incrementalist.Workers.DailyBonusGrant do
  @moduledoc """
  Scheduled job that triggers precisely on the 12-hour UTC boundaries.
  Updates all player states with daily_tokens = 0 to 1, and broadcasts an update
  to all active PlayerServer processes.
  """
  use GenServer
  require Logger
  alias Incrementalist.Repo
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Time
  alias Incrementalist.Game.Persistence.PlayerState

  def start_link(_) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @impl true
  def init(state) do
    schedule_next_run()
    {:ok, state}
  end

  @impl true
  def handle_info(:run_grant, state) do
    Logger.info("Executing Daily Bonus Token Grant...")
    
    import Ecto.Query
    
    # Efficient bulk update
    Repo.update_all(
      from(s in PlayerState, where: s.has_daily_token == false),
      set: [has_daily_token: true]
    )

    # Broadcast to active players
    Registry.select(Incrementalist.Game.Session.PlayerRegistry, [{{:"$1", :"$2", :_}, [], [{{:"$1", :"$2"}}]}])
    |> Enum.each(fn {_player_id, pid} ->
      send(pid, :daily_bonus_boundary_reached)
    end)

    schedule_next_run()
    {:noreply, state}
  end

  defp schedule_next_run do
    now = Time.to_unix_ms(Time.now())
    anchor = Time.to_unix_ms(Constants.daily_bonus_rotation_anchor_at())
    slot_ms = Constants.daily_bonus_slot_ms()

    elapsed = max(0, now - anchor)
    next_boundary_index = div(elapsed, slot_ms) + 1
    next_boundary_ms = anchor + (next_boundary_index * slot_ms)
    
    delay_ms = max(1000, next_boundary_ms - now)
    Process.send_after(self(), :run_grant, delay_ms)
  end
end
