defmodule Incrementalist.Game.Push.ClimateCacheTest do
  use ExUnit.Case, async: false

  alias Incrementalist.Game.Push.ClimateCache
  alias Incrementalist.Game.Time

  test "reuses climate within the same UTC minute and recomputes on minute boundary" do
    :sys.replace_state(ClimateCache, fn _ ->
      %{minute_index: nil, climate: nil, computed_at_ms: nil}
    end)

    first = ~U[2026-05-28 10:31:00.000000Z]
    same_minute = DateTime.add(first, 45, :second)
    next_minute = DateTime.add(first, 60, :second)

    first_climate = ClimateCache.visible_state(first)
    first_state = :sys.get_state(ClimateCache)

    assert is_map(first_climate)
    assert first_state.minute_index == div(Time.to_unix_ms(first), 60_000)
    assert first_state.computed_at_ms == Time.to_unix_ms(first)

    same_climate = ClimateCache.visible_state(same_minute)
    same_state = :sys.get_state(ClimateCache)

    assert same_climate == first_climate
    assert same_state.minute_index == first_state.minute_index
    assert same_state.computed_at_ms == first_state.computed_at_ms

    next_climate = ClimateCache.visible_state(next_minute)
    next_state = :sys.get_state(ClimateCache)

    assert is_map(next_climate)
    assert next_state.minute_index == div(Time.to_unix_ms(next_minute), 60_000)
    assert next_state.computed_at_ms == Time.to_unix_ms(next_minute)
  end
end
