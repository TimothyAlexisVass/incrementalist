defmodule Incrementalist.Game.Features.OrchardSoilTest do
  use ExUnit.Case, async: true

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

    assert projected.water_level == 94
    assert_in_delta BigNum.to_float(projected.nitrogen), 9.4, 1.0e-9
    assert_in_delta BigNum.to_float(projected.phosphorus), 9.7, 1.0e-9
    assert_in_delta BigNum.to_float(projected.potassium), 9.4, 1.0e-9
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

  defp with_soil(%State{} = state, %SoilState{} = soil), do: %{state | soil: soil}

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
end
