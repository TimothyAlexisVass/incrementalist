defmodule Incrementalist.Workers.BonusTimeGrant do
  @moduledoc """
  Scheduled job that triggers precisely on the 12-hour UTC boundaries.
  Updates all player states with has_bonustime_token = false to true, and broadcasts an update
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
    Logger.info("Executing BonusTime Token Grant...")

    import Ecto.Query

    # Efficient bulk update
    Repo.update_all(
      from(s in PlayerState, where: s.has_bonustime_token == false),
      set: [has_bonustime_token: true]
    )

    # Broadcast to active players
    Registry.select(Incrementalist.Game.Session.PlayerRegistry, [
      {{:"$1", :"$2", :_}, [], [{{:"$1", :"$2"}}]}
    ])
    |> Enum.each(fn {_player_id, pid} ->
      send(pid, :bonustime_boundary_reached)
    end)

    schedule_next_run()
    {:noreply, state}
  end

  defp schedule_next_run do
    now = Time.to_unix_ms(Time.now())
    anchor = Time.to_unix_ms(Constants.bonustime_rotation_anchor_at())
    slot_ms = Constants.bonustime_slot_ms()

    elapsed = max(0, now - anchor)
    next_boundary_index = div(elapsed, slot_ms) + 1
    next_boundary_ms = anchor + next_boundary_index * slot_ms

    delay_ms = max(1000, next_boundary_ms - now)
    Process.send_after(self(), :run_grant, delay_ms)
  end
end
