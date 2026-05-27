defmodule Incrementalist.Game.Climate do
  @moduledoc """
  Server-authoritative UTC climate projection for climate-relevant wire fields.
  """

  alias Incrementalist.Game.{Constants, Time}

  def visible_state(now \\ Time.now()) do
    epoch = Constants.climate_epoch_at()
    now_ms = Time.to_unix_ms(now)
    epoch_ms = Time.to_unix_ms(epoch)
    year_start = Constants.climate_year_start()

    hour_ms = Constants.climate_hour_ms()
    hours_per_day = Constants.climate_day_hours()
    days_per_season = Constants.climate_days_per_season()
    seasons = Constants.climate_season_order()
    seasons_per_year = length(seasons)
    hours_per_season = hours_per_day * days_per_season
    hours_per_year = hours_per_season * seasons_per_year

    elapsed_hours =
      now_ms
      |> Kernel.-(epoch_ms)
      |> div(hour_ms)
      |> max(0)

    year_index = div(elapsed_hours, hours_per_year)
    year = year_start + year_index
    hour_in_year = rem(elapsed_hours, hours_per_year)
    day_in_year = div(hour_in_year, hours_per_day) + 1

    weather_entry = Constants.climate_weather_entry(elapsed_hours)
    rain_mm = Map.fetch!(weather_entry, "mm")
    temperature_c = Map.fetch!(weather_entry, "c")

    %{
      "epoch_at" => Time.iso8601(epoch),
      "year" => year,
      "day_in_year" => day_in_year,
      "temperature_c" => temperature_c,
      "rain_mm" => rain_mm
    }
  end
end
