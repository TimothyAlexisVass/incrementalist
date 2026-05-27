defmodule Incrementalist.Game.Push.GlobalTicker do
  @moduledoc """
  Broadcasts shared global UTC minute ticks to connected game channels.
  """

  use GenServer

  alias Incrementalist.Game.{Climate, Time}

  @pubsub Incrementalist.PubSub
  @topic "game:global"
  @minute_ms 60_000

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, %{}, Keyword.put_new(opts, :name, __MODULE__))
  end

  def topic, do: @topic

  def next_minute_boundary_ms(now_ms) when is_integer(now_ms) do
    (div(now_ms, @minute_ms) + 1) * @minute_ms
  end

  def global_tick_payload(%DateTime{} = at) do
    %{
      "type" => "global.tick",
      "server_time" => Time.iso8601(at),
      "climate" => Climate.visible_state(at)
    }
  end

  @impl true
  def init(state) do
    schedule_next_tick(Time.to_unix_ms(Time.now()))
    {:ok, state}
  end

  @impl true
  def handle_info({:emit_global_tick, boundary_ms}, state) do
    boundary_time = DateTime.from_unix!(boundary_ms, :millisecond)

    Phoenix.PubSub.broadcast(
      @pubsub,
      @topic,
      {:global_tick, global_tick_payload(boundary_time)}
    )

    schedule_next_tick(Time.to_unix_ms(Time.now()))
    {:noreply, state}
  end

  defp schedule_next_tick(now_ms) do
    boundary_ms = next_minute_boundary_ms(now_ms)
    delay_ms = max(1, boundary_ms - now_ms)
    Process.send_after(self(), {:emit_global_tick, boundary_ms}, delay_ms)
  end
end
