defmodule Incrementalist.Game.ClimateTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.{Climate, Constants, Time}

  test "visible_state reads weather entries by elapsed-hour modulo with minute rain distribution" do
    epoch = Constants.climate_epoch_at()
    first_entry = Constants.climate_weather_entry(0)

    state_now = Climate.visible_state(epoch)
    assert_in_delta(state_now["rain_mm"], Map.fetch!(first_entry, "mm") / 60.0, 1.0e-9)
    assert state_now["temperature_c"] >= Map.fetch!(first_entry, "c") - 2
    assert state_now["temperature_c"] <= Map.fetch!(first_entry, "c") + 2

    count = Constants.climate_weather_entry_count()
    loop_ms = Time.to_unix_ms(epoch) + count * Constants.climate_hour_ms()
    loop_now = DateTime.from_unix!(loop_ms, :millisecond)
    state_loop = Climate.visible_state(loop_now)

    assert_in_delta(state_loop["rain_mm"], state_now["rain_mm"], 1.0e-9)
  end

  test "visible_state exposes only the client-consumed climate fields" do
    state = Climate.visible_state(Constants.climate_epoch_at())

    assert Map.keys(state) |> Enum.sort() == [
             "day_in_year",
             "epoch_at",
             "rain_mm",
             "temperature_c",
             "year"
           ]
  end

  test "temperature jitter is deterministic within the same UTC minute" do
    now = ~U[2026-05-27 10:31:00.000000Z]
    same_minute = DateTime.add(now, 45, :second)

    state_a = Climate.visible_state(now)
    state_b = Climate.visible_state(same_minute)

    assert state_a["temperature_c"] == state_b["temperature_c"]
  end
end
