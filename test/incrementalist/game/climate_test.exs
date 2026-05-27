defmodule Incrementalist.Game.ClimateTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.{Climate, Constants, Time}

  test "visible_state reads weather entries by elapsed-hour modulo" do
    epoch = Constants.climate_epoch_at()
    first_entry = Constants.climate_weather_entry(0)

    state_now = Climate.visible_state(epoch)
    assert state_now["rain_mm"] == Map.fetch!(first_entry, "mm")
    assert state_now["temperature_c"] == Map.fetch!(first_entry, "c")

    count = Constants.climate_weather_entry_count()
    loop_ms = Time.to_unix_ms(epoch) + count * Constants.climate_hour_ms()
    loop_now = DateTime.from_unix!(loop_ms, :millisecond)
    state_loop = Climate.visible_state(loop_now)

    assert state_loop["rain_mm"] == state_now["rain_mm"]
    assert state_loop["temperature_c"] == state_now["temperature_c"]
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
end
