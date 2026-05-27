defmodule Incrementalist.Game.Features.Orchard.Soil do
  @moduledoc """
  Server-authoritative Orchard soil projection.

  Soil is projected in whole UTC minute steps and only loses nutrients and
  organic matter when water is lost (dry-down or overflow).
  """

  alias Incrementalist.Game.{Constants, State, Time}
  alias Incrementalist.Game.State.Soil, as: SoilState
  @minute_ms 60_000

  def project_state(%State{} = state, now) do
    normalized = normalize_soil(state.soil, now)
    %{state | soil: project_soil(normalized, now)}
  end

  def visible_state(nil), do: visible_state(%SoilState{})

  def visible_state(%SoilState{} = soil) do
    normalized = normalize_soil(soil, Time.now())
    water_cap = water_cap_from_organic_matter(normalized.organic_matter)

    %{
      "water" => normalized.water_level,
      "water_cap" => water_cap,
      "nitrogen" => normalized.nitrogen,
      "phosphorus" => normalized.phosphorus,
      "potassium" => normalized.potassium,
      "organic_matter" => normalized.organic_matter,
      "organic_matter_cap" => Constants.orchard_soil_organic_matter_max()
    }
  end

  def runoff_rate_from_organic_matter(%BigNum{} = organic_matter) do
    ratio = organic_matter_ratio(organic_matter)
    retention_at_max = Constants.orchard_soil_runoff_retention_factor_at_max()

    1.0 - retention_at_max * ratio
  end

  def water_cap_from_organic_matter(%BigNum{} = organic_matter) do
    ratio = organic_matter_ratio(organic_matter)
    base = Constants.orchard_soil_water_cap_base()
    bonus_at_max = Constants.orchard_soil_water_cap_bonus_at_max()

    base + trunc(Float.round(bonus_at_max * ratio))
  end

  defp project_soil(%SoilState{} = soil, now) do
    hour_ms = Constants.climate_hour_ms()
    projected_at = parse_projected_at(soil.projected_at, now, @minute_ms)
    projected_at_ms = Time.to_unix_ms(projected_at)
    now_ms = Time.to_unix_ms(now)

    elapsed_minutes =
      now_ms
      |> Kernel.-(projected_at_ms)
      |> div(@minute_ms)
      |> max(0)

    if elapsed_minutes <= 0 do
      %{soil | projected_at: Time.iso8601(projected_at)}
    else
      elapsed_full_hours = div(elapsed_minutes, 60)
      elapsed_remaining_minutes = rem(elapsed_minutes, 60)

      after_hours =
        apply_steps(soil, elapsed_full_hours, fn hour_offset, current ->
          hour_start_ms = projected_at_ms + hour_offset * hour_ms
          project_single_hour(current, hour_start_ms)
        end)

      minutes_base_ms = projected_at_ms + elapsed_full_hours * hour_ms

      result =
        apply_steps(after_hours, elapsed_remaining_minutes, fn minute_offset, current ->
          minute_start_ms = minutes_base_ms + minute_offset * @minute_ms
          project_single_minute(current, minute_start_ms)
        end)

      %{
        result
        | projected_at:
            Time.iso8601(DateTime.add(projected_at, elapsed_minutes * @minute_ms, :millisecond))
      }
    end
  end

  defp project_single_hour(%SoilState{} = soil, hour_start_ms) do
    hour_index = climate_hour_index(hour_start_ms)
    weather_entry = Constants.climate_weather_entry(hour_index)
    rain_mm = max(0.0, number(Map.get(weather_entry, "mm")))

    runoff_rate = runoff_rate_from_organic_matter(soil.organic_matter)
    water_cap = water_cap_from_organic_matter(soil.organic_matter)
    current_water = clamp_number(soil.water_level, 0.0, number(water_cap))

    {next_water, water_lost} =
      if rain_mm > 0.0 do
        rain_ratio = Constants.orchard_soil_rain_mm_to_water_ratio()
        gained_water = rain_mm * number(rain_ratio)
        water_after_rain = current_water + gained_water
        overflow_loss = max(0.0, water_after_rain - water_cap)

        {
          clamp_number(water_after_rain - overflow_loss, 0.0, water_cap),
          overflow_loss
        }
      else
        dry_down_loss = Constants.orchard_soil_base_dry_down_per_hour() * runoff_rate
        effective_loss = min(current_water, max(0.0, dry_down_loss))

        {
          clamp_number(current_water - effective_loss, 0.0, water_cap),
          effective_loss
        }
      end

    apply_water_loss(%{soil | water_level: next_water}, water_lost)
  end

  defp project_single_minute(%SoilState{} = soil, minute_start_ms) do
    hour_index = climate_hour_index(minute_start_ms)
    weather_entry = Constants.climate_weather_entry(hour_index)
    rain_mm_per_minute = max(0.0, number(Map.get(weather_entry, "mm")) / 60.0)

    runoff_rate = runoff_rate_from_organic_matter(soil.organic_matter)
    water_cap = water_cap_from_organic_matter(soil.organic_matter)
    current_water = clamp_number(soil.water_level, 0.0, number(water_cap))

    {next_water, water_lost} =
      if rain_mm_per_minute > 0.0 do
        rain_ratio = Constants.orchard_soil_rain_mm_to_water_ratio()
        gained_water = rain_mm_per_minute * number(rain_ratio)
        water_after_rain = current_water + gained_water
        overflow_loss = max(0.0, water_after_rain - water_cap)

        {
          clamp_number(water_after_rain - overflow_loss, 0.0, water_cap),
          overflow_loss
        }
      else
        dry_down_loss = Constants.orchard_soil_base_dry_down_per_hour() * runoff_rate / 60.0
        effective_loss = min(current_water, max(0.0, dry_down_loss))

        {
          clamp_number(current_water - effective_loss, 0.0, water_cap),
          effective_loss
        }
      end

    apply_water_loss(%{soil | water_level: next_water}, water_lost)
  end

  defp apply_water_loss(%SoilState{} = soil, water_lost) when water_lost <= 0.0 do
    soil
  end

  defp apply_water_loss(%SoilState{} = soil, water_lost) do
    nk_coeff = Constants.orchard_soil_nk_leach_per_water_loss()
    p_multiplier = Constants.orchard_soil_phosphorus_leach_multiplier()
    om_coeff = Constants.orchard_soil_organic_matter_leach_per_water_loss()

    nk_loss = BigNum.from_number(water_lost * nk_coeff)
    p_loss = BigNum.from_number(water_lost * nk_coeff * p_multiplier)
    om_loss = BigNum.from_number(water_lost * om_coeff)

    %{
      soil
      | nitrogen: clamp_big_num_non_negative(BigNum.sub(soil.nitrogen, nk_loss)),
        phosphorus: clamp_big_num_non_negative(BigNum.sub(soil.phosphorus, p_loss)),
        potassium: clamp_big_num_non_negative(BigNum.sub(soil.potassium, nk_loss)),
        organic_matter:
          soil.organic_matter
          |> BigNum.sub(om_loss)
          |> clamp_big_num_non_negative()
          |> clamp_big_num_organic_matter_max()
    }
  end

  defp normalize_soil(nil, now), do: normalize_soil(%SoilState{}, now)

  defp normalize_soil(%SoilState{} = soil, now) do
    normalized_nitrogen =
      soil.nitrogen
      |> normalize_big_num(Constants.orchard_soil_default_nitrogen())
      |> clamp_big_num_non_negative()

    normalized_organic_matter =
      soil.organic_matter
      |> normalize_big_num(Constants.orchard_soil_default_organic_matter())
      |> clamp_big_num_non_negative()
      |> clamp_big_num_organic_matter_max()

    water_cap = water_cap_from_organic_matter(normalized_organic_matter)

    clamped_water = clamp_number(number(soil.water_level), 0.0, number(water_cap))

    %SoilState{
      water_level: clamped_water,
      nitrogen: normalized_nitrogen,
      phosphorus:
        soil.phosphorus
        |> normalize_big_num(Constants.orchard_soil_default_phosphorus())
        |> clamp_big_num_non_negative(),
      potassium:
        soil.potassium
        |> normalize_big_num(Constants.orchard_soil_default_potassium())
        |> clamp_big_num_non_negative(),
      organic_matter: normalized_organic_matter,
      projected_at: Time.iso8601(parse_projected_at(soil.projected_at, now, @minute_ms))
    }
  end

  defp parse_projected_at(value, now, hour_ms) when is_binary(value) do
    case Time.from_iso8601(value) do
      {:ok, dt} -> clamp_to_boundary(dt, hour_ms)
      _ -> clamp_to_boundary(now, hour_ms)
    end
  end

  defp parse_projected_at(_value, now, hour_ms), do: clamp_to_boundary(now, hour_ms)

  defp clamp_to_boundary(%DateTime{} = dt, hour_ms) do
    dt
    |> Time.to_unix_ms()
    |> div(hour_ms)
    |> Kernel.*(hour_ms)
    |> DateTime.from_unix!(:millisecond)
  end

  defp climate_hour_index(hour_start_ms) do
    epoch_ms = Constants.climate_epoch_at() |> Time.to_unix_ms()

    hour_start_ms
    |> Kernel.-(epoch_ms)
    |> div(Constants.climate_hour_ms())
    |> max(0)
  end

  defp clamp_big_num_non_negative(%BigNum{} = value) do
    if BigNum.compare(value, BigNum.zero()) < 0 do
      BigNum.zero()
    else
      value
    end
  end

  defp clamp_big_num_organic_matter_max(%BigNum{} = value) do
    max_value = BigNum.from_number(Constants.orchard_soil_organic_matter_max())

    if BigNum.compare(value, max_value) > 0 do
      max_value
    else
      value
    end
  end

  defp normalize_big_num(%BigNum{} = value, _default), do: value
  defp normalize_big_num(nil, default), do: default

  defp normalize_big_num(%{"m" => m, "e" => e}, _default) do
    BigNum.new(number(m), trunc(number(e)))
  end

  defp normalize_big_num(_value, default), do: default

  defp organic_matter_ratio(%BigNum{} = organic_matter) do
    max_value = Constants.orchard_soil_organic_matter_max()

    if max_value <= 0 do
      0.0
    else
      organic_matter
      |> BigNum.to_float()
      |> clamp_number(number(Constants.orchard_soil_organic_matter_min()), number(max_value))
      |> Kernel./(max_value)
    end
  end

  defp clamp_number(value, min_value, max_value) do
    value
    |> max(min_value)
    |> min(max_value)
  end

  defp apply_steps(value, step_count, _fun) when step_count <= 0, do: value

  defp apply_steps(value, step_count, fun) when is_integer(step_count) do
    Enum.reduce(0..(step_count - 1), value, fn offset, current ->
      fun.(offset, current)
    end)
  end

  defp number(value) when is_integer(value), do: value * 1.0
  defp number(value) when is_float(value), do: value
  defp number(_value), do: 0.0
end
