defmodule Incrementalist.Game.Persistence.CommandLog.Cleanup do
  use GenServer

  alias Incrementalist.Game.Persistence.CommandLog
  alias Incrementalist.Game.Sessions

  @hour_ms 60 * 60 * 1000

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
    Sessions.cleanup_expired_tokens()
    schedule_cleanup()
    {:noreply, state}
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, @hour_ms)
  end
end
