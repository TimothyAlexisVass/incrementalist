defmodule Incrementalist.Game.Persistence.CommandLog.Cleanup do
  @moduledoc """
  Daily maintenance process for old acknowledged commands and inactive anonymous players.

  Cleanup is deliberately outside command execution so queue correctness does
  not depend on this process running on time.
  """

  use GenServer

  alias Incrementalist.Game.Persistence.CommandLog
  alias Incrementalist.Game.Persistence.Player

  @day_ms 24 * 60 * 60 * 1000

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    schedule_cleanup()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    CommandLog.cleanup_acked()
    Player.cleanup_anonymous()
    schedule_cleanup()
    {:noreply, state}
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, @day_ms)
  end
end
