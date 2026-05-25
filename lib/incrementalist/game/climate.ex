defmodule Incrementalist.Game.Climate do
  @moduledoc """
  Server-authoritative UTC climate projection for year/season/day-night/weather.
  """

  alias Incrementalist.Game.{Constants, Time}

  @lcg_modulus 2_147_483_647
  @lcg_multiplier 48_271

  def visible_state(now \\ Time.now()) do
    epoch = Constants.climate_epoch_at()
    now_ms = Time.to_unix_ms(now)
    epoch_ms = Time.to_unix_ms(epoch)
    year_start = Constants.climate_year_start()

    hour_ms = Constants.climate_hour_ms()
    hours_per_day = Constants.climate_day_hours()
    game_day_start_hour = Constants.climate_game_day_start_hour()
    game_night_start_hour = Constants.climate_game_night_start_hour()
    days_per_season = Constants.climate_days_per_season()
    seasons = Constants.climate_season_order()
    seasons_per_year = length(seasons)
    hours_per_season = hours_per_day * days_per_season
    hours_per_year = hours_per_season * seasons_per_year
    days_per_year = days_per_season * seasons_per_year

    elapsed_hours =
      now_ms
      |> Kernel.-(epoch_ms)
      |> div(hour_ms)
      |> max(0)

    year_index = div(elapsed_hours, hours_per_year)
    year = year_start + year_index
    hour_in_year = rem(elapsed_hours, hours_per_year)
    season_index = div(hour_in_year, hours_per_season)
    season = Enum.at(seasons, season_index) || "spring"
    day_in_year = div(hour_in_year, hours_per_day) + 1
    day_in_season = rem(day_in_year - 1, days_per_season) + 1

    game_total_minutes =
      rem(
        game_day_start_hour * 60 + floor(elapsed_hours * (24 / hours_per_day) * 60),
        24 * 60
      )

    game_hour = div(game_total_minutes, 60)

    day_phase =
      if game_hour >= game_day_start_hour and game_hour < game_night_start_hour,
        do: "day",
        else: "night"

    season_temp = Constants.climate_season_temperature_range(season)
    min_temp_c = season_temp.min_c
    max_temp_c = season_temp.max_c
    rain_chance = Constants.climate_season_rain_chance_per_hour(season)

    rain_mm =
      if deterministic_ratio(elapsed_hours, 17) < rain_chance do
        deterministic_int(elapsed_hours, 97, 1, Constants.climate_rainfall_max_mm())
      else
        0
      end

    base_temp_c = deterministic_int(elapsed_hours, 211, min_temp_c, max_temp_c)
    rain_cooling_c = if rain_mm > 0, do: Constants.climate_rain_cooling_c(), else: 0
    temperature_c = max(min_temp_c, base_temp_c - rain_cooling_c)

    %{
      "epoch_at" => Time.iso8601(epoch),
      "hour_ms" => hour_ms,
      "hours_per_day" => hours_per_day,
      "year_start" => year_start,
      "game_day_start_hour" => game_day_start_hour,
      "game_night_start_hour" => game_night_start_hour,
      "days_per_season" => days_per_season,
      "days_per_year" => days_per_year,
      "year" => year,
      "season_index" => season_index,
      "season" => season,
      "season_label" => Constants.climate_season_label(season),
      "day_in_season" => day_in_season,
      "day_in_year" => day_in_year,
      "day_phase" => day_phase,
      "is_day" => day_phase == "day",
      "temperature_c" => temperature_c,
      "rain_mm" => rain_mm,
      "rain_intensity" => rain_intensity(rain_mm),
      "next_hour_at" => next_hour_boundary_iso(now_ms),
      "next_day_phase_at" => next_day_phase_boundary_iso(now_ms, hour_ms),
      "season_temperature_min_c" => min_temp_c,
      "season_temperature_max_c" => max_temp_c,
      "season_rain_chance_per_hour" => rain_chance
    }
  end

  defp rain_intensity(mm) do
    Constants.climate_rain_bands()
    |> Enum.find(fn band -> mm >= band["min_mm"] and mm <= band["max_mm"] end)
    |> case do
      nil -> "none"
      band -> band["id"]
    end
  end

  defp next_hour_boundary_iso(now_ms) do
    hour_ms = Constants.climate_hour_ms()
    next_hour_ms = (div(now_ms, hour_ms) + 1) * hour_ms
    next_hour_ms |> DateTime.from_unix!(:millisecond) |> Time.iso8601()
  end

  defp next_day_phase_boundary_iso(now_ms, hour_ms) do
    # Day/night alternates every one real-time hour (half of a 2-hour in-game day).
    next_phase_ms = (div(now_ms, hour_ms) + 1) * hour_ms
    next_phase_ms |> DateTime.from_unix!(:millisecond) |> Time.iso8601()
  end

  defp deterministic_int(hour_index, salt, min_value, max_value) do
    range = max_value - min_value + 1
    value = floor(deterministic_ratio(hour_index, salt) * range)
    min_value + min(range - 1, max(0, value))
  end

  defp deterministic_ratio(hour_index, salt) do
    seed = positive_mod(hour_index + salt, @lcg_modulus - 1) + 1
    next = rem(seed * @lcg_multiplier, @lcg_modulus)
    next / @lcg_modulus
  end

  defp positive_mod(value, modulus) do
    rem(rem(value, modulus) + modulus, modulus)
  end
end
