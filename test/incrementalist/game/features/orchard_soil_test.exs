defmodule Incrementalist.Game.Features.OrchardSoilTest do
  use ExUnit.Case, async: true

  alias BigNum
  alias Incrementalist.Game.{Constants, State, Time}
  alias Incrementalist.Game.Features.Orchard.Soil
  alias Incrementalist.Game.State.Soil, as: SoilState

  test "organic matter interpolation produces expected runoff and water cap" do
    assert_in_delta Soil.runoff_rate_from_organic_matter(BigNum.zero()), 1.0, 1.0e-9
    assert Soil.water_cap_from_organic_matter(BigNum.zero()) == 150

    mid_om = BigNum.from_number(1000)
    assert_in_delta Soil.runoff_rate_from_organic_matter(mid_om), 0.75, 1.0e-9
    assert Soil.water_cap_from_organic_matter(mid_om) == 200

    max_om = BigNum.from_number(2000)
    assert_in_delta Soil.runoff_rate_from_organic_matter(max_om), 0.5, 1.0e-9
    assert Soil.water_cap_from_organic_matter(max_om) == 250
  end

  test "dry hour applies water loss and proportional leaching with phosphorus at half rate" do
    {start_time, now} = first_hour_window(fn mm -> mm == 0 end)

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 100,
        nitrogen: BigNum.from_number(10),
        phosphorus: BigNum.from_number(10),
        potassium: BigNum.from_number(10),
        organic_matter: BigNum.from_number(0),
        projected_at: Time.iso8601(start_time)
      })

    projected = Soil.project_state(state, now).soil

    assert_in_delta projected.water_level, 94.0, 1.0e-9
    assert_in_delta BigNum.to_float(projected.nitrogen), 9.4, 1.0e-9
    assert_in_delta BigNum.to_float(projected.phosphorus), 9.7, 1.0e-9
    assert_in_delta BigNum.to_float(projected.potassium), 9.4, 1.0e-9
    assert_in_delta BigNum.to_float(projected.organic_matter), 0.0, 1.0e-9
  end

  test "minute projection accumulates fractional dry-down without losing precision" do
    {start_time, minute_now} = first_minute_window(fn mm -> mm == 0 end)

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 100.0,
        nitrogen: BigNum.from_number(10),
        phosphorus: BigNum.from_number(10),
        potassium: BigNum.from_number(10),
        organic_matter: BigNum.from_number(0),
        projected_at: Time.iso8601(start_time)
      })

    projected = Soil.project_state(state, minute_now).soil

    assert_in_delta projected.water_level, 99.9, 1.0e-9
    assert_in_delta BigNum.to_float(projected.nitrogen), 9.99, 1.0e-9
    assert_in_delta BigNum.to_float(projected.phosphorus), 9.995, 1.0e-9
    assert_in_delta BigNum.to_float(projected.potassium), 9.99, 1.0e-9
    assert_in_delta BigNum.to_float(projected.organic_matter), 0.0, 1.0e-9
  end

  test "rain hour below cap does not leach nutrients or organic matter" do
    {start_time, now} = first_hour_window(fn mm -> mm > 0 and mm <= 30 end)

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 90,
        nitrogen: BigNum.from_number(10),
        phosphorus: BigNum.from_number(10),
        potassium: BigNum.from_number(10),
        organic_matter: BigNum.from_number(0),
        projected_at: Time.iso8601(start_time)
      })

    projected = Soil.project_state(state, now).soil

    assert projected.water_level <= 150
    assert BigNum.compare(projected.nitrogen, BigNum.from_number(10)) == 0
    assert BigNum.compare(projected.phosphorus, BigNum.from_number(10)) == 0
    assert BigNum.compare(projected.potassium, BigNum.from_number(10)) == 0
    assert BigNum.compare(projected.organic_matter, BigNum.zero()) == 0
  end

  test "overflow during rain counts as water loss and leaches" do
    {start_time, now} = first_hour_window(fn mm -> mm >= 120 end)

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 140,
        nitrogen: BigNum.from_number(20),
        phosphorus: BigNum.from_number(20),
        potassium: BigNum.from_number(20),
        organic_matter: BigNum.from_number(100),
        projected_at: Time.iso8601(start_time)
      })

    projected = Soil.project_state(state, now).soil

    assert projected.water_level <= Soil.water_cap_from_organic_matter(projected.organic_matter)
    assert BigNum.compare(projected.nitrogen, BigNum.from_number(20)) < 0
    assert BigNum.compare(projected.phosphorus, BigNum.from_number(20)) < 0
    assert BigNum.compare(projected.potassium, BigNum.from_number(20)) < 0
    assert BigNum.compare(projected.organic_matter, BigNum.from_number(100)) < 0
  end

  test "multi-hour projection is deterministic" do
    {start_time, now} = first_hour_window(fn _mm -> true end, 6)

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 110,
        nitrogen: BigNum.from_number(50),
        phosphorus: BigNum.from_number(50),
        potassium: BigNum.from_number(50),
        organic_matter: BigNum.from_number(300),
        projected_at: Time.iso8601(start_time)
      })

    once = Soil.project_state(state, now)
    twice = Soil.project_state(state, now)

    assert once.soil.water_level == twice.soil.water_level
    assert BigNum.compare(once.soil.nitrogen, twice.soil.nitrogen) == 0
    assert BigNum.compare(once.soil.phosphorus, twice.soil.phosphorus) == 0
    assert BigNum.compare(once.soil.potassium, twice.soil.potassium) == 0
    assert BigNum.compare(once.soil.organic_matter, twice.soil.organic_matter) == 0
    assert once.soil.projected_at == twice.soil.projected_at
  end

  test "4h3m catch-up matches four hour-steps plus three minute-steps" do
    {start_time, _} = first_hour_window(fn _mm -> true end)
    four_hours_ms = 4 * Constants.climate_hour_ms()
    three_minutes_ms = 3 * 60_000
    now = DateTime.add(start_time, four_hours_ms + three_minutes_ms, :millisecond)

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 110.0,
        nitrogen: BigNum.from_number(50),
        phosphorus: BigNum.from_number(50),
        potassium: BigNum.from_number(50),
        organic_matter: BigNum.from_number(300),
        projected_at: Time.iso8601(start_time)
      })

    direct = Soil.project_state(state, now).soil

    after_hours_at = DateTime.add(start_time, four_hours_ms, :millisecond)
    after_hours_state = Soil.project_state(state, after_hours_at)
    split = Soil.project_state(after_hours_state, now).soil

    assert split.water_level == direct.water_level
    assert BigNum.compare(split.nitrogen, direct.nitrogen) == 0
    assert BigNum.compare(split.phosphorus, direct.phosphorus) == 0
    assert BigNum.compare(split.potassium, direct.potassium) == 0
    assert BigNum.compare(split.organic_matter, direct.organic_matter) == 0
    assert split.projected_at == direct.projected_at
  end

  test "plant growth within a minute respects each plot planted_at timestamp" do
    {start_time, _} = first_hour_window(fn _mm -> true end)
    now = DateTime.add(start_time, 70_000, :millisecond)

    early_plant = %State.Plant{
      plant_id: "clover_patch",
      growth: 0.0,
      level: 1,
      planted_at: Time.iso8601(DateTime.add(start_time, 5, :second))
    }

    late_plant = %State.Plant{
      plant_id: "clover_patch",
      growth: 0.0,
      level: 1,
      planted_at: Time.iso8601(DateTime.add(start_time, 55, :second))
    }

    plots = [
      %State.Plot{id: "plot_1", depth: 1, plant: early_plant, decomposition: nil},
      %State.Plot{id: "plot_2", depth: 1, plant: late_plant, decomposition: nil}
    ]

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 100.0,
        nitrogen: BigNum.from_number(50),
        phosphorus: BigNum.from_number(50),
        potassium: BigNum.from_number(50),
        organic_matter: BigNum.from_number(20),
        projected_at: Time.iso8601(start_time)
      })
      |> Map.put(:plots, plots)

    projected = Soil.project_state(state, now)
    early_growth = plot_growth(projected.plots, "plot_1")
    late_growth = plot_growth(projected.plots, "plot_2")

    assert early_growth > late_growth
  end

  test "visible partial-minute projection applies only elapsed milliseconds, not a full minute" do
    {start_time, _} = first_hour_window(fn _mm -> true end)
    now = DateTime.add(start_time, 8, :second)

    plant = %State.Plant{
      plant_id: "clover_patch",
      growth: 0.0,
      level: 1,
      planted_at: Time.iso8601(DateTime.add(start_time, 5, :second))
    }

    plots = [
      %State.Plot{id: "plot_1", depth: 1, plant: plant, decomposition: nil}
    ]

    state =
      State.new(start_time)
      |> with_soil(%SoilState{
        water_level: 100.0,
        nitrogen: BigNum.from_number(50),
        phosphorus: BigNum.from_number(50),
        potassium: BigNum.from_number(50),
        organic_matter: BigNum.from_number(20),
        projected_at: Time.iso8601(start_time)
      })
      |> Map.put(:plots, plots)

    [projected_plot] = Soil.project_visible_plots(state, now)
    growth = projected_plot.plant.growth

    assert growth > 0.0
    assert growth < 0.5
  end

  defp with_soil(%State{} = state, %SoilState{} = soil), do: %{state | soil: soil}

  defp plot_growth(plots, plot_id) do
    plots
    |> Enum.find(&(&1.id == plot_id))
    |> then(fn plot -> plot.plant.growth end)
  end

  defp first_hour_window(mm_predicate, hour_span \\ 1) do
    epoch = Constants.climate_epoch_at()
    hour_ms = Constants.climate_hour_ms()

    hour_index =
      0..(Constants.climate_weather_entry_count() - 1)
      |> Enum.find(fn idx ->
        weather = Constants.climate_weather_entry(idx)
        mm_predicate.(Map.fetch!(weather, "mm"))
      end)

    if is_nil(hour_index) do
      raise "No weather hour found for predicate"
    end

    start_time = DateTime.add(epoch, hour_index * hour_ms, :millisecond)
    now = DateTime.add(start_time, hour_span * hour_ms, :millisecond)
    {start_time, now}
  end

  defp first_minute_window(mm_predicate) do
    {start_time, _hour_now} = first_hour_window(mm_predicate, 1)
    minute_ms = 60_000
    now = DateTime.add(start_time, minute_ms, :millisecond)
    {start_time, now}
  end
end
