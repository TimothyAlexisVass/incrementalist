defmodule Incrementalist.Game.Push.ClimateCache do
  @moduledoc """
  Computes minute climate once globally and reuses it for all player ticks
  within the same UTC minute boundary.
  """

  use GenServer

  alias Incrementalist.Game.{Climate, Time}

  @minute_ms 60_000

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, %{}, Keyword.put_new(opts, :name, __MODULE__))
  end

  def visible_state(now \\ Time.now())

  def visible_state(%DateTime{} = now) do
    case Process.whereis(__MODULE__) do
      nil -> Climate.visible_state(now)
      _pid -> GenServer.call(__MODULE__, {:visible_state, now})
    end
  end

  @impl true
  def init(_state) do
    {:ok, %{minute_index: nil, climate: nil, computed_at_ms: nil}}
  end

  @impl true
  def handle_call({:visible_state, %DateTime{} = now}, _from, state) do
    minute_index = minute_index(now)

    if state.minute_index == minute_index and is_map(state.climate) do
      {:reply, state.climate, state}
    else
      climate = Climate.visible_state(now)

      {:reply, climate,
       %{
         minute_index: minute_index,
         climate: climate,
         computed_at_ms: Time.to_unix_ms(now)
       }}
    end
  end

  defp minute_index(%DateTime{} = now) do
    now
    |> Time.to_unix_ms()
    |> div(@minute_ms)
  end
end
