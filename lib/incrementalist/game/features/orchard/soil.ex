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
    normalized_soil = normalize_soil(state.soil, now)
    normalized_furnace = normalize_furnace(state.furnace, now)

    {projected_soil, projected_plots, projected_furnace} =
      project_unified(normalized_soil, state.plots || [], normalized_furnace, now)

    %{state | soil: projected_soil, plots: projected_plots, furnace: projected_furnace}
  end

  def enqueue_burn(%State.Furnace{} = furnace, %BigNum{} = amount, %DateTime{} = now) do
    State.Furnace.append_burn_batch(furnace, amount, Time.iso8601(now))
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

  defp normalize_furnace(%State.Furnace{} = furnace, now) do
    batches =
      furnace.burn_batches
      |> Kernel.||([])
      |> Enum.map(&normalize_burn_batch(&1, now))
      |> Enum.reject(&(BigNum.compare(&1.amount, BigNum.zero()) <= 0))

    %State.Furnace{
      burn_batches: batches,
      projected_at: Time.iso8601(parse_projected_at(furnace.projected_at, now, @minute_ms))
    }
  end

  defp normalize_burn_batch(%State.Furnace.BurnBatch{} = batch, _now) do
    case Time.from_iso8601(batch.available_at) do
      {:ok, available_at} ->
        %State.Furnace.BurnBatch{
          amount: batch.amount |> normalize_big_num() |> clamp_big_num_non_negative(),
          available_at: Time.iso8601(available_at)
        }

      _ ->
        empty_burn_batch()
    end
  end

  defp normalize_burn_batch(_batch, _now), do: empty_burn_batch()

  defp empty_burn_batch do
    %State.Furnace.BurnBatch{
      amount: BigNum.zero(),
      available_at: nil
    }
  end

  @doc """
  Projects plot progress within the current UTC minute for payload rendering
  without mutating durable state.
  """
  def project_visible_plots(%State{} = state, now, opts \\ []) do
    normalized_soil = normalize_soil(state.soil, now)
    plots = state.plots || []
    skip_plot_ids = opts |> Keyword.get(:skip_plot_ids, []) |> MapSet.new()

    projected_at = parse_projected_at(normalized_soil.projected_at, now, @minute_ms)
    projected_at_ms = Time.to_unix_ms(projected_at)
    now_ms = Time.to_unix_ms(now)
    elapsed_ms = max(now_ms - projected_at_ms, 0)
    remainder_ms = rem(elapsed_ms, @minute_ms)

    if remainder_ms <= 0 do
      plots
    else
      minute_start_ms = now_ms - remainder_ms
      temperature_c = minute_temperature(minute_start_ms)

      Enum.map(plots, fn plot ->
        if MapSet.member?(skip_plot_ids, plot.id) do
          plot
        else
          project_plot_partial_minute(
            plot,
            normalized_soil,
            temperature_c,
            minute_start_ms,
            remainder_ms
          )
        end
      end)
    end
  end

  defp project_unified(%SoilState{} = soil, plots, %State.Furnace{} = furnace, now) do
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
      {
        %{soil | projected_at: Time.iso8601(projected_at)},
        plots,
        %{furnace | projected_at: Time.iso8601(projected_at)}
      }
    else
      elapsed_full_hours = div(elapsed_minutes, 60)
      elapsed_remaining_minutes = rem(elapsed_minutes, 60)

      {after_hours_soil, after_hours_plots, after_hours_furnace} =
        apply_steps({soil, plots, furnace}, elapsed_full_hours, fn hour_offset,
                                                                   {curr_soil, curr_plots,
                                                                    curr_furnace} ->
          hour_start_ms = projected_at_ms + hour_offset * hour_ms
          project_single_hour_unified(curr_soil, curr_plots, curr_furnace, hour_start_ms)
        end)

      minutes_base_ms = projected_at_ms + elapsed_full_hours * hour_ms

      {result_soil, result_plots, result_furnace} =
        apply_steps(
          {after_hours_soil, after_hours_plots, after_hours_furnace},
          elapsed_remaining_minutes,
          fn minute_offset, {curr_soil, curr_plots, curr_furnace} ->
            minute_start_ms = minutes_base_ms + minute_offset * @minute_ms
            project_single_minute_unified(curr_soil, curr_plots, curr_furnace, minute_start_ms)
          end
        )

      {
        %{
          result_soil
          | projected_at:
              Time.iso8601(DateTime.add(projected_at, elapsed_minutes * @minute_ms, :millisecond))
        },
        result_plots,
        %{
          result_furnace
          | projected_at:
              Time.iso8601(DateTime.add(projected_at, elapsed_minutes * @minute_ms, :millisecond))
        }
      }
    end
  end

  defp project_single_hour_unified(
         %SoilState{} = soil,
         plots,
         %State.Furnace{} = furnace,
         hour_start_ms
       ) do
    apply_steps({soil, plots, furnace}, 60, fn minute_offset,
                                               {curr_soil, curr_plots, curr_furnace} ->
      minute_start_ms = hour_start_ms + minute_offset * @minute_ms
      project_single_minute_unified(curr_soil, curr_plots, curr_furnace, minute_start_ms)
    end)
  end

  defp project_single_minute_unified(
         %SoilState{} = soil,
         plots,
         %State.Furnace{} = furnace,
         minute_start_ms
       ) do
    {next_furnace, soil_with_k} = burn_batches_for_minute(furnace, soil, minute_start_ms)

    hour_index = climate_hour_index(minute_start_ms)
    weather_entry = Constants.climate_weather_entry(hour_index)
    rain_mm_per_minute = max(0.0, number(Map.get(weather_entry, "mm")) / 60.0)

    runoff_rate = runoff_rate_from_organic_matter(soil_with_k.organic_matter)
    water_cap = water_cap_from_organic_matter(soil_with_k.organic_matter)
    current_water = clamp_number(soil_with_k.water_level, 0.0, number(water_cap))

    {next_water, water_lost} =
      if rain_mm_per_minute > 0.0 do
        gained_water = rain_mm_per_minute
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

    leached_soil = apply_water_loss(%{soil_with_k | water_level: next_water}, water_lost)

    temperature_c = minute_temperature(minute_start_ms)

    {final_soil, final_plots} =
      Enum.reduce(plots, {leached_soil, []}, fn plot, {acc_soil, acc_plots} ->
        {next_soil, next_plot} =
          project_plot_single_minute(plot, acc_soil, temperature_c, minute_start_ms)

        {next_soil, [next_plot | acc_plots]}
      end)

    {final_soil, Enum.reverse(final_plots), next_furnace}
  end

  defp burn_batches_for_minute(%State.Furnace{} = furnace, %SoilState{} = soil, minute_start_ms) do
    burn_rate = BigNum.from_number(Constants.furnace_burn_rate_per_minute())
    minute_end_ms = minute_start_ms + @minute_ms

    {remaining_batches, burned} =
      consume_burn_batches(
        furnace.burn_batches || [],
        burn_rate,
        minute_start_ms * 1.0,
        minute_end_ms,
        BigNum.zero(),
        []
      )

    if BigNum.compare(burned, BigNum.zero()) > 0 do
      k_gain = BigNum.mul(burned, BigNum.from_number(Constants.furnace_ash_yield_ratio()))

      {
        %{furnace | burn_batches: remaining_batches},
        %{soil | potassium: BigNum.add(soil.potassium, k_gain)}
      }
    else
      {%{furnace | burn_batches: remaining_batches}, soil}
    end
  end

  defp consume_burn_batches(
         [],
         _burn_rate,
         _burn_cursor_ms,
         _minute_end_ms,
         burned,
         remaining_reversed
       ) do
    {Enum.reverse(remaining_reversed), burned}
  end

  defp consume_burn_batches(
         [batch | remaining],
         burn_rate,
         burn_cursor_ms,
         minute_end_ms,
         burned,
         remaining_reversed
       ) do
    burn_starts_at_ms = max(burn_cursor_ms, burn_batch_available_at_ms(batch))

    if burn_starts_at_ms >= minute_end_ms do
      {Enum.reverse(remaining_reversed, [batch | remaining]), burned}
    else
      remaining_minute_ratio = (minute_end_ms - burn_starts_at_ms) / @minute_ms
      available_capacity = BigNum.mul(burn_rate, BigNum.from_number(remaining_minute_ratio))
      batch_burned = BigNum.min(batch.amount, available_capacity)
      remaining_amount = BigNum.sub(batch.amount, batch_burned)

      next_remaining_reversed =
        if BigNum.compare(remaining_amount, BigNum.zero()) > 0 do
          [%{batch | amount: remaining_amount} | remaining_reversed]
        else
          remaining_reversed
        end

      next_burn_cursor_ms =
        if BigNum.compare(remaining_amount, BigNum.zero()) > 0 do
          minute_end_ms
        else
          burn_starts_at_ms +
            BigNum.to_float(BigNum.div(batch_burned, burn_rate)) * @minute_ms
        end

      consume_burn_batches(
        remaining,
        burn_rate,
        next_burn_cursor_ms,
        minute_end_ms,
        BigNum.add(burned, batch_burned),
        next_remaining_reversed
      )
    end
  end

  defp burn_batch_available_at_ms(%State.Furnace.BurnBatch{available_at: available_at}) do
    case Time.from_iso8601(available_at) do
      {:ok, available_at} -> Time.to_unix_ms(available_at) * 1.0
      _ -> :infinity
    end
  end

  defp project_plot_single_minute(plot, %SoilState{} = soil, temperature_c, minute_start_ms) do
    cond do
      not is_nil(plot.plant) ->
        plant = plot.plant
        plant_specs = Incrementalist.Game.Constants.orchard_plant_defs()
        spec = Map.get(plant_specs, plant.plant_id)

        if spec && plant.growth < 100.0 do
          min_temp = Map.get(spec, "minTemp", 0.0)
          min_water = Map.get(spec, "minWater", 0.0)

          if temperature_c >= min_temp and soil.water_level >= min_water do
            active_ratio = activity_ratio(plant.planted_at, minute_start_ms, @minute_ms)

            if active_ratio <= 0.0 do
              {soil, plot}
            else
              n_ratio = get_nutrient_ratio(soil.nitrogen, spec, "nitrogen")
              k_ratio = get_nutrient_ratio(soil.potassium, spec, "potassium")

              growth_boost = 1.0 + n_ratio * 0.5 + k_ratio * 0.5
              base_rate = Map.get(spec, "baseGrowthTime", 100.0) / 60.0
              next_progress = min(100.0, plant.growth + base_rate * growth_boost * active_ratio)

              n_fixing = Map.get(spec, "nitrogenFixing", 0.0) / 60.0

              next_soil =
                if n_fixing > 0.0 do
                  %{
                    soil
                    | nitrogen:
                        BigNum.add(soil.nitrogen, BigNum.from_number(n_fixing * active_ratio))
                  }
                else
                  soil
                end

              next_plant = %{plant | growth: next_progress}

              {next_soil, %{plot | plant: next_plant}}
            end
          else
            {soil, plot}
          end
        else
          {soil, plot}
        end

      not is_nil(plot.decomposition) ->
        decomp = plot.decomposition
        active_ratio = activity_ratio(decomp.started_at, minute_start_ms, @minute_ms)

        if active_ratio <= 0.0 do
          {soil, plot}
        else
          next_progress = decomp.progress + 10.0 * active_ratio

          if next_progress >= 100.0 do
            size_val = decomp.amount
            p_coeff = if decomp.resource_id == "fruit", do: 0.2, else: 0.1

            multiplier = Constants.orchard_soil_decomposition_biomass_multiplier()
            om_gain = BigNum.from_number(BigNum.to_float(size_val) * multiplier)
            p_gain = BigNum.from_number(BigNum.to_float(size_val) * p_coeff * multiplier)

            next_soil = %{
              soil
              | organic_matter:
                  clamp_big_num_organic_matter_max(BigNum.add(soil.organic_matter, om_gain)),
                phosphorus: BigNum.add(soil.phosphorus, p_gain)
            }

            {next_soil, %{plot | decomposition: nil}}
          else
            next_decomp = %{decomp | progress: next_progress}
            {soil, %{plot | decomposition: next_decomp}}
          end
        end

      true ->
        {soil, plot}
    end
  end

  defp project_plot_partial_minute(
         plot,
         %SoilState{} = soil,
         temperature_c,
         minute_start_ms,
         elapsed_ms
       )
       when elapsed_ms > 0 do
    window_ms = min(elapsed_ms, @minute_ms)
    minute_window_ratio = window_ms / @minute_ms

    cond do
      not is_nil(plot.plant) ->
        plant = plot.plant
        plant_specs = Constants.orchard_plant_defs()
        spec = Map.get(plant_specs, plant.plant_id)

        if spec && plant.growth < 100.0 do
          min_temp = Map.get(spec, "minTemp", 0.0)
          min_water = Map.get(spec, "minWater", 0.0)

          if temperature_c >= min_temp and soil.water_level >= min_water do
            active_ratio =
              partial_activity_ratio(
                plant.planted_at,
                minute_start_ms,
                window_ms,
                minute_window_ratio
              )

            if active_ratio <= 0.0 do
              plot
            else
              n_ratio = get_nutrient_ratio(soil.nitrogen, spec, "nitrogen")
              k_ratio = get_nutrient_ratio(soil.potassium, spec, "potassium")

              growth_boost = 1.0 + n_ratio * 0.5 + k_ratio * 0.5
              base_rate = Map.get(spec, "baseGrowthTime", 100.0) / 60.0

              next_progress =
                min(100.0, plant.growth + base_rate * growth_boost * active_ratio)

              %{plot | plant: %{plant | growth: next_progress}}
            end
          else
            plot
          end
        else
          plot
        end

      not is_nil(plot.decomposition) ->
        decomp = plot.decomposition

        if decomp.progress < 100.0 do
          active_ratio =
            partial_activity_ratio(
              decomp.started_at,
              minute_start_ms,
              window_ms,
              minute_window_ratio
            )

          if active_ratio <= 0.0 do
            plot
          else
            next_progress = min(100.0, decomp.progress + 10.0 * active_ratio)
            %{plot | decomposition: %{decomp | progress: next_progress}}
          end
        else
          plot
        end

      true ->
        plot
    end
  end

  defp project_plot_partial_minute(plot, _soil, _temperature_c, _minute_start_ms, _elapsed_ms),
    do: plot

  defp activity_ratio(nil, _window_start_ms, _window_ms), do: 1.0

  defp activity_ratio(started_at, window_start_ms, window_ms)
       when is_binary(started_at) and is_integer(window_start_ms) and is_integer(window_ms) and
              window_ms > 0 do
    case Time.from_iso8601(started_at) do
      {:ok, started_at_dt} ->
        started_at_ms = Time.to_unix_ms(started_at_dt)
        window_end_ms = window_start_ms + window_ms
        active_start_ms = max(window_start_ms, started_at_ms)
        active_ms = max(window_end_ms - active_start_ms, 0)
        min(1.0, active_ms / window_ms)

      _ ->
        1.0
    end
  end

  defp activity_ratio(_started_at, _window_start_ms, _window_ms), do: 1.0

  defp partial_activity_ratio(started_at, window_start_ms, window_ms, minute_window_ratio)
       when is_binary(started_at) and is_integer(window_start_ms) and is_integer(window_ms) and
              window_ms > 0 do
    case Time.from_iso8601(started_at) do
      {:ok, _dt} -> activity_ratio(started_at, window_start_ms, window_ms) * minute_window_ratio
      _ -> 0.0
    end
  end

  defp partial_activity_ratio(_started_at, _window_start_ms, _window_ms, _minute_window_ratio),
    do: 0.0

  defp minute_temperature(minute_start_ms) do
    epoch_ms = Constants.climate_epoch_at() |> Time.to_unix_ms()
    elapsed_minutes = div(minute_start_ms - epoch_ms, @minute_ms)
    elapsed_hours = div(elapsed_minutes, 60)
    temp_weather_entry = Constants.climate_weather_entry(elapsed_hours)
    base_temp = Map.fetch!(temp_weather_entry, "c")
    temp_jitter = :erlang.phash2(elapsed_minutes, 5) - 2
    base_temp + temp_jitter
  end

  defp get_nutrient_ratio(%BigNum{} = soil_val, spec, key) do
    case Map.get(spec, key) do
      %{"max" => max_val} ->
        max_f = to_float(normalize_big_num(max_val))
        if max_f > 0.0, do: min(1.0, BigNum.to_float(soil_val) / max_f), else: 0.0

      %{max: max_val} ->
        max_f = to_float(normalize_big_num(max_val))
        if max_f > 0.0, do: min(1.0, BigNum.to_float(soil_val) / max_f), else: 0.0

      _ ->
        0.0
    end
  end

  defp to_float(%BigNum{} = val), do: BigNum.to_float(val)
  defp to_float(val) when is_number(val), do: val * 1.0
  defp to_float(_), do: 0.0

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
          |> clamp_big_num_organic_matter_min()
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
      |> clamp_big_num_organic_matter_min()
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

  defp clamp_big_num_organic_matter_min(%BigNum{} = value) do
    min_value = BigNum.from_number(Constants.orchard_soil_organic_matter_min())

    if BigNum.compare(value, min_value) < 0 do
      min_value
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

  defp normalize_big_num(%BigNum{} = value), do: value
  defp normalize_big_num(%{"m" => m, "e" => e}), do: BigNum.new(number(m), trunc(number(e)))
  defp normalize_big_num(%{m: m, e: e}), do: BigNum.new(number(m), trunc(number(e)))
  defp normalize_big_num(value) when is_number(value), do: BigNum.from_number(value)
  defp normalize_big_num(_), do: BigNum.zero()

  defp normalize_big_num(nil, default), do: default
  defp normalize_big_num(value, _default), do: normalize_big_num(value)

  defp organic_matter_ratio(%BigNum{} = organic_matter) do
    min_value = number(Constants.orchard_soil_organic_matter_min())
    max_value = Constants.orchard_soil_organic_matter_max()
    range = max_value - min_value

    if range <= 0 do
      0.0
    else
      current_value =
        organic_matter
        |> BigNum.to_float()
        |> clamp_number(min_value, number(max_value))

      (current_value - min_value) / range
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
