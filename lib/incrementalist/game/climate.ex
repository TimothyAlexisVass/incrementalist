defmodule Incrementalist.Game.Climate do
  @moduledoc """
  Server-authoritative UTC climate projection for climate-relevant wire fields.
  """

  alias Incrementalist.Game.{Constants, Time}
  @minute_ms 60_000

  def visible_state(now \\ Time.now()) do
    epoch = Constants.climate_epoch_at()
    now_ms = Time.to_unix_ms(now)
    epoch_ms = Time.to_unix_ms(epoch)
    year_start = Constants.climate_year_start()

    elapsed_minutes =
      now_ms
      |> Kernel.-(epoch_ms)
      |> max(0)
      |> div(@minute_ms)

    elapsed_hours = div(elapsed_minutes, 60)

    hours_per_day = Constants.climate_day_hours()
    days_per_season = Constants.climate_days_per_season()
    seasons_per_year = max(length(Constants.climate_season_order()), 1)
    minutes_per_day = hours_per_day * 60
    minutes_per_year = minutes_per_day * days_per_season * seasons_per_year

    year_index = div(elapsed_minutes, minutes_per_year)
    year = year_start + year_index
    minute_in_year = rem(elapsed_minutes, minutes_per_year)
    day_in_year = div(minute_in_year, minutes_per_day) + 1

    weather_entry = Constants.climate_weather_entry(elapsed_hours)
    rain_mm = Map.fetch!(weather_entry, "mm") / 60.0
    base_temperature_c = Map.fetch!(weather_entry, "c")
    minute_index = div(now_ms, @minute_ms)
    temperature_c = base_temperature_c + temperature_jitter_for_minute(minute_index)

    %{
      "epoch_at" => Time.iso8601(epoch),
      "year" => year,
      "day_in_year" => day_in_year,
      "temperature_c" => temperature_c,
      "rain_mm" => rain_mm
    }
  end

  defp temperature_jitter_for_minute(minute_index) do
    :erlang.phash2(minute_index, 5) - 2
  end
end
