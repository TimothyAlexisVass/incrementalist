defmodule Incrementalist.Game.ConstantsTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.Progress.Sisu.Levels

  test "shared area and tip requirements are loaded from the manifest" do
    assert [
             %{key: "sage", unlock_level: 1},
             %{key: "orchard", unlock_level: 1},
             %{key: "furnace", unlock_level: 1},
             %{key: "cloverfield", unlock_level: 6},
             %{key: "market", unlock_level: 15}
           ] = Constants.area_defs()

    assert [1, 2, 4, 6, 15] = Constants.sage_tip_levels()
  end

  test "shop_item_defs/0 loads the shared shop requirements manifest" do
    assert [
             %{
               id: "idle_mode",
               name: "Idle Mode",
               description: "Allows you to claim rewards automatically!",
               cost: %BigNum{m: 5.0, e: 2},
               currency: :coins,
               required_level: 2
             },
             %{
               id: "sisu_generator",
               name: "Sisu Generator",
               description: "Multiply your progress bar fill speed!",
               cost: %BigNum{m: 2.0, e: 3},
               currency: :coins,
               required_level: 4
             },
             %{
               id: "bonus_time",
               name: "BONUSTIME",
               description: "Play Bonustime games and win daily prizes!",
               cost: %BigNum{m: 1.0, e: 3},
               currency: :shards,
               required_level: 15
             }
           ] = Constants.shop_item_defs()
  end

  test "furnace levels load from shared furnace requirements" do
    assert Constants.furnace_min_level() == 1
    assert Constants.furnace_max_level() == 8
  end

  test "climate values load from shared climate requirements" do
    assert Constants.climate_hour_ms() == 3_600_000
    assert Constants.climate_day_hours() == 2
    assert Constants.climate_year_start() == 1008
    assert Constants.climate_game_day_start_hour() == 8
    assert Constants.climate_game_night_start_hour() == 20
    assert Constants.climate_days_per_season() == 84
    assert Constants.climate_rainfall_max_mm() == 350
    assert Constants.climate_season_order() == ["spring", "summer", "autumn", "winter"]
    assert Constants.climate_season_temperature_range("winter") == %{min_c: 10, max_c: 20}
    assert Constants.climate_season_rain_chance_per_hour("autumn") == 0.18
  end

  test "climate weather lookup wraps by modulo" do
    count = Constants.climate_weather_entry_count()
    assert count > 0

    first = Constants.climate_weather_entry(0)
    wrapped = Constants.climate_weather_entry(count)

    assert first == wrapped
    assert is_number(Map.fetch!(first, "mm"))
    assert is_number(Map.fetch!(first, "c"))
  end

  test "orchard soil values load from shared orchard requirements" do
    assert Constants.orchard_soil_default_water_level() == 100
    assert Constants.orchard_soil_default_nitrogen() == %BigNum{m: 5.0, e: 0}
    assert Constants.orchard_soil_default_phosphorus() == %BigNum{m: 5.0, e: 0}
    assert Constants.orchard_soil_default_potassium() == %BigNum{m: 5.0, e: 0}
    assert Constants.orchard_soil_default_organic_matter() == %BigNum{m: 2.0, e: 1}
    assert Constants.orchard_soil_organic_matter_min() == 0
    assert Constants.orchard_soil_organic_matter_max() == 2000
    assert Constants.orchard_soil_runoff_retention_factor_at_max() == 0.5
    assert Constants.orchard_soil_water_cap_base() == 150
    assert Constants.orchard_soil_water_cap_bonus_at_max() == 100
    assert Constants.orchard_soil_base_dry_down_per_hour() == 6
    assert Constants.orchard_soil_rain_mm_to_water_ratio() == 1
    assert Constants.orchard_soil_nk_leach_per_water_loss() == 0.1
    assert Constants.orchard_soil_phosphorus_leach_multiplier() == 0.5
    assert Constants.orchard_soil_organic_matter_leach_per_water_loss() == 0.05
  end

  test "sisu levels load the shared upgrade table" do
    assert Levels.base_max() == 2.0
    assert Levels.per_level() == 0.5
    assert Levels.max_upgrade_level() == 1769
    assert %BigNum{m: 2.5, e: 3} = Levels.upgrade_cost(1)
    assert %BigNum{m: 1.0, e: 7} = Levels.upgrade_cost(12)
    assert %BigNum{m: 9.5, e: 7} = Levels.upgrade_cost(18)
    assert %BigNum{m: 6.5, e: 299} = Levels.upgrade_cost(Levels.max_upgrade_level())
  end
end
