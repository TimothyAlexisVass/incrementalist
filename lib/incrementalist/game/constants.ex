defmodule Incrementalist.Game.Constants do
  @moduledoc """
  Centralizes magic numbers and domain limits.
  """

  @requirements_dir Path.expand("../../../shared/requirements", __DIR__)
  @unlocking_path Path.join(@requirements_dir, "unlocking.json")
  @furnace_path Path.join(@requirements_dir, "furnace.json")
  @quests_path Path.join(@requirements_dir, "quests.json")
  @achievements_path Path.join(@requirements_dir, "achievements.json")
  @bonustime_path Path.join(@requirements_dir, "bonustime.json")
  @climate_path Path.join(@requirements_dir, "climate.json")
  @weather_path Path.join(@requirements_dir, "weather.json")
  @orchard_soil_path Path.join(@requirements_dir, "orchard.json")
  @orchard_plants_path Path.join(@requirements_dir, "plants.json")
  @orchard_seed_splicing_path Path.join(@requirements_dir, "splicing.json")
  @orchard_seed_shop_path Path.join(@requirements_dir, "seeds.json")
  @external_resource @unlocking_path
  @external_resource @furnace_path
  @external_resource @quests_path
  @external_resource @achievements_path
  @external_resource @bonustime_path
  @external_resource @climate_path
  @external_resource @weather_path
  @external_resource @orchard_soil_path
  @external_resource @orchard_plants_path
  @external_resource @orchard_seed_splicing_path
  @external_resource @orchard_seed_shop_path
  @unlocking @unlocking_path |> File.read!() |> Jason.decode!()
  @furnace @furnace_path |> File.read!() |> Jason.decode!()
  @quests @quests_path |> File.read!() |> Jason.decode!()
  @achievements @achievements_path |> File.read!() |> Jason.decode!()
  @bonustime @bonustime_path |> File.read!() |> Jason.decode!()
  @climate @climate_path |> File.read!() |> Jason.decode!()
  @weather @weather_path |> File.read!() |> Jason.decode!()
  @orchard_soil @orchard_soil_path |> File.read!() |> Jason.decode!()
  @orchard_plants @orchard_plants_path |> File.read!() |> Jason.decode!()
  @orchard_seed_splicing @orchard_seed_splicing_path |> File.read!() |> Jason.decode!()
  @orchard_seed_shop @orchard_seed_shop_path |> File.read!() |> Jason.decode!()
  @climate_weather_entries_tuple :erlang.list_to_tuple(@weather)
  @climate_weather_entry_count tuple_size(@climate_weather_entries_tuple)
  @area_unlocking_entries @unlocking |> Enum.filter(&(&1["type"] == "area"))
  @shop_item_unlocking_entries @unlocking |> Enum.filter(&(&1["type"] == "shop-item"))
  @furnace_level_rows Map.fetch!(@furnace, "levels")
  @furnace_level_numbers Enum.map(@furnace_level_rows, &Map.fetch!(&1, "level"))
  @furnace_min_level Enum.min(@furnace_level_numbers)
  @furnace_max_level Enum.max(@furnace_level_numbers)
  @climate_season_rows Map.fetch!(@climate, "seasons")
  @climate_season_order Enum.map(@climate_season_rows, &Map.fetch!(&1, "id"))
  @climate_season_lookup Map.new(@climate_season_rows, fn row -> {Map.fetch!(row, "id"), row} end)
  @default_sage_tip_level 1
  @area_unlock_levels @area_unlocking_entries
                      |> Map.new(fn %{"id" => id, "required_level" => required_level} ->
                        {id, required_level}
                      end)
  @shop_item_unlock_levels @shop_item_unlocking_entries
                           |> Map.new(fn %{"id" => id, "required_level" => required_level} ->
                             {id, required_level}
                           end)

  def max_queued_commands, do: 10
  def valid_command_ids, do: 0..(max_queued_commands() - 1)

  # Climate / Time Constants (global for all players)
  def climate_hour_ms, do: Map.fetch!(@climate, "hour_ms")
  def climate_day_hours, do: Map.fetch!(@climate, "day_hours")
  def climate_year_start, do: Map.fetch!(@climate, "year_start")
  def climate_game_day_start_hour, do: Map.fetch!(@climate, "game_day_start_hour")
  def climate_game_night_start_hour, do: Map.fetch!(@climate, "game_night_start_hour")
  def climate_days_per_season, do: Map.fetch!(@climate, "days_per_season")
  def climate_rainfall_max_mm, do: climate_torrential_band_max_mm()
  def climate_rain_bands, do: Map.fetch!(@climate, "rain_bands")
  def climate_season_order, do: @climate_season_order
  def climate_weather_entry_count, do: @climate_weather_entry_count

  def climate_weather_entry(hour_index) when is_integer(hour_index) and hour_index >= 0 do
    if @climate_weather_entry_count == 0 do
      raise "weather.json must contain at least one weather entry"
    end

    elem(@climate_weather_entries_tuple, rem(hour_index, @climate_weather_entry_count))
  end

  def climate_epoch_at do
    case Application.get_env(:incrementalist, :climate_epoch_override) do
      %DateTime{} = dt ->
        dt

      iso when is_binary(iso) ->
        case DateTime.from_iso8601(iso) do
          {:ok, dt, _} -> dt
          _ -> default_climate_epoch_at()
        end

      _ ->
        default_climate_epoch_at()
    end
  end

  def climate_season_temperature_range(season) do
    season_row = climate_season_row(season)
    temp = Map.fetch!(season_row, "temperature")

    %{
      min_c: Map.fetch!(temp, "min_c"),
      max_c: Map.fetch!(temp, "max_c")
    }
  end

  def climate_season_rain_chance_per_hour(season) do
    season
    |> climate_season_row()
    |> Map.fetch!("rain_chance_per_hour")
  end

  def climate_season_label(season) do
    season
    |> climate_season_row()
    |> Map.fetch!("label")
  end

  def orchard_plant_defs, do: @orchard_plants
  def orchard_seed_splicing_defs, do: @orchard_seed_splicing
  def orchard_seed_shop_defs, do: @orchard_seed_shop

  # Orchard / Soil Constants
  def orchard_soil_default_water_level do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("defaults")
    |> Map.fetch!("water_level")
  end

  def orchard_soil_default_nitrogen do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("defaults")
    |> Map.fetch!("nitrogen")
    |> to_big_num()
  end

  def orchard_soil_default_phosphorus do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("defaults")
    |> Map.fetch!("phosphorus")
    |> to_big_num()
  end

  def orchard_soil_default_potassium do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("defaults")
    |> Map.fetch!("potassium")
    |> to_big_num()
  end

  def orchard_soil_default_organic_matter do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("defaults")
    |> Map.fetch!("organic_matter")
    |> to_big_num()
  end

  def orchard_soil_organic_matter_min do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("organic_matter")
    |> Map.fetch!("min")
  end

  def orchard_soil_organic_matter_max do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("organic_matter")
    |> Map.fetch!("max")
  end

  def orchard_soil_runoff_retention_factor_at_max do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("organic_matter")
    |> Map.fetch!("runoff_retention_factor_at_max")
  end

  def orchard_soil_water_cap_base do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("organic_matter")
    |> Map.fetch!("water_cap_base")
  end

  def orchard_soil_water_cap_bonus_at_max do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("organic_matter")
    |> Map.fetch!("water_cap_bonus_at_max")
  end

  def orchard_soil_base_dry_down_per_hour do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("base_dry_down_per_hour")
  end

  def orchard_soil_nk_leach_per_water_loss do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("leach")
    |> Map.fetch!("nitrogen_and_potassium_per_water_loss")
  end

  def orchard_soil_phosphorus_leach_multiplier do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("leach")
    |> Map.fetch!("phosphorus_multiplier")
  end

  def orchard_soil_organic_matter_leach_per_water_loss do
    @orchard_soil
    |> Map.fetch!("soil")
    |> Map.fetch!("leach")
    |> Map.fetch!("organic_matter_per_water_loss")
  end

  # Clover Hunt Constants
  def clover_hunt_click_step, do: 100
  def clover_hunt_first_four_leaf_clicks, do: 100
  def clover_hunt_second_four_leaf_clicks, do: 200
  def clover_hunt_first_five_leaf_clicks, do: 300
  def clover_hunt_second_five_leaf_clicks, do: 400
  def clover_hunt_third_five_leaf_clicks, do: 500
  def clover_hunt_first_six_leaf_clicks, do: 600
  def clover_hunt_max_background_stage, do: 6

  # Furnace Constants
  def furnace_min_level, do: @furnace_min_level
  def furnace_max_level, do: @furnace_max_level

  def area_defs do
    @area_unlocking_entries
    |> Enum.map(&normalize_area/1)
    |> Enum.sort_by(& &1.unlock_level)
  end

  def shop_item_defs do
    Enum.map(@shop_item_unlocking_entries, &normalize_shop_item/1)
  end

  def quest_defs do
    for {category, quests} <- @quests, {id, quest} <- quests, into: %{} do
      {id, normalize_quest(id, quest, category)}
    end
  end

  def achievement_defs do
    Enum.map(@achievements, &normalize_achievement/1)
  end

  def bonustime_rotation do
    bonustime_games()
    |> Enum.into(%{}, fn {game_id, game} ->
      {Integer.to_string(Map.fetch!(game, "slot")), game_id}
    end)
  end

  def bonustime_games do
    @bonustime["games"]
  end

  def bonustime_checklist do
    Map.fetch!(bonustime_game_rules(), "checklists")
  end

  def bonustime_checklist_grid_columns do
    Map.fetch!(bonustime_checklist(), "grid_columns")
  end

  def bonustime_checklist_grid_rows do
    Map.fetch!(bonustime_checklist(), "grid_rows")
  end

  def bonustime_checklist_entries do
    Map.fetch!(bonustime_checklist(), "entries")
  end

  def bonustime_slot_ms, do: 43_200_000
  def bonustime_rotation_slot_count, do: map_size(bonustime_games())
  def bonustime_game_rules, do: @bonustime["game_rules"]

  def bonustime_rotation_anchor_at do
    case Application.get_env(:incrementalist, :bonustime_rotation_anchor_override) do
      %DateTime{} = dt ->
        dt

      iso when is_binary(iso) ->
        case DateTime.from_iso8601(iso) do
          {:ok, dt, _} -> dt
          _ -> default_bonustime_rotation_anchor_at()
        end

      _ ->
        default_bonustime_rotation_anchor_at()
    end
  end

  defp default_bonustime_rotation_anchor_at, do: climate_epoch_at()

  defp default_climate_epoch_at do
    {:ok, dt, _} = DateTime.from_iso8601(Map.fetch!(@climate, "epoch_utc"))
    dt
  end

  defp climate_season_row(season) when is_atom(season),
    do: climate_season_row(Atom.to_string(season))

  defp climate_season_row(season) when is_binary(season) do
    case Map.fetch(@climate_season_lookup, season) do
      {:ok, row} ->
        row

      :error ->
        Map.fetch!(@climate_season_lookup, hd(@climate_season_order))
    end
  end

  defp climate_torrential_band_max_mm do
    @climate
    |> Map.fetch!("rain_bands")
    |> Enum.find(&(&1["id"] == "torrential"))
    |> case do
      nil -> raise "climate.rain_bands must include a torrential band"
      band -> Map.fetch!(band, "max_mm")
    end
  end

  defp to_big_num(%{"m" => m, "e" => e}) do
    BigNum.new(m, e)
  end

  # Progress Bar Constants
  def progress_bar_max_fill, do: 100.0
  def progress_bar_new_player_bonus_fill_multiplier, do: 2.5
  def progress_bar_new_player_bonus_fill_bonus, do: 20.0
  def progress_bar_late_new_player_bonus_fill_multiplier, do: 7.25
  def progress_bar_base_idle_mode_off_fill_rate, do: 0.8
  def progress_bar_base_idle_mode_on_fill_rate, do: 0.24
  def progress_bar_sisu_min_multiplier, do: 1.0
  def trust_required_fame_base_multiplier, do: 10.1
  def trust_required_fame_base_addition, do: 9
  def trust_required_fame_small_snap_threshold, do: 1000
  def trust_required_fame_small_snap_step, do: 10
  def sisu_diminishment_reduction_factor_per_cycle, do: 0.98
  def sisu_refill_threshold_factor, do: 0.9

  def charge_crystal_azure_claim_interval, do: 9
  def charge_crystal_aether_claim_interval, do: 40
  def charge_crystal_lucent_level_interval, do: 24
  def charge_crystal_transcendent_level_interval, do: 100

  # Notice IDs
  def notice_parent_menu_main, do: "parent.menu.main"
  def notice_parent_tab_shop, do: "parent.tab.shop"
  def notice_parent_tab_quest, do: "parent.tab.quest"
  def notice_parent_tab_quest_main, do: "parent.tab.quest.main"
  def notice_parent_tab_quest_daily, do: "parent.tab.quest.daily"
  def notice_parent_tab_achievements, do: "parent.tab.achievements"
  def notice_parent_area_dropdown, do: "parent.area.dropdown"

  def notice_leaf_area_dropdown_button, do: "leaf.area_dropdown.button"
  def notice_leaf_tab_shop_button, do: "leaf.tab.shop.button"
  def notice_leaf_tab_quest_button, do: "leaf.tab.quest.button"
  def notice_leaf_tab_quest_main_button, do: "leaf.tab.quest.main.button"
  def notice_leaf_tab_quest_daily_button, do: "leaf.tab.quest.daily.button"
  def notice_leaf_tab_achievements_button, do: "leaf.tab.achievements.button"
  def notice_leaf_tab_menu_any_button, do: "leaf.tab.menu.any.button"

  def sage_tip_levels do
    sage_tip_level_unlocks()
    |> Map.values()
    |> Enum.uniq()
    |> Enum.sort()
  end

  def sage_tip_level_unlocks do
    %{
      "1" => @default_sage_tip_level,
      "2" => unlock_required_level!(@shop_item_unlock_levels, "shop-item", "idle_mode"),
      "4" => unlock_required_level!(@shop_item_unlock_levels, "shop-item", "sisu_generator"),
      "7" => unlock_required_level!(@area_unlock_levels, "area", "cloverfield"),
      "15" => unlock_required_level!(@area_unlock_levels, "area", "market")
    }
  end

  def sage_tip_event_ids do
    [
      "clover_4_leaf",
      "clover_5_leaf",
      "clover_6_leaf"
    ]
  end

  def sage_tip_ids do
    (Map.keys(sage_tip_level_unlocks()) ++ sage_tip_event_ids())
    |> Enum.uniq()
  end

  defp normalize_area(%{
         "id" => id,
         "name" => name,
         "description" => description,
         "required_level" => required_level
       }) do
    %{
      key: id,
      name: name,
      description: description,
      unlock_level: required_level
    }
  end

  defp normalize_shop_item(%{
         "id" => id,
         "name" => name,
         "description" => description,
         "cost" => cost,
         "currency" => currency,
         "required_level" => required_level
       }) do
    %{
      id: id,
      name: name,
      description: description,
      cost: BigNum.normalize(%BigNum{m: cost["m"], e: cost["e"]}),
      currency: normalize_shop_currency(currency),
      required_level: required_level
    }
  end

  defp unlock_required_level!(unlock_levels, unlock_type, unlock_id) do
    case Map.fetch(unlock_levels, unlock_id) do
      {:ok, required_level} ->
        required_level

      :error ->
        raise ArgumentError,
              "missing unlock requirement for #{unlock_type} #{inspect(unlock_id)}"
    end
  end

  defp normalize_shop_currency("coins"), do: :coins
  defp normalize_shop_currency("shards"), do: :shards
  defp normalize_shop_currency("cores"), do: :cores

  defp normalize_shop_currency(currency),
    do: raise(ArgumentError, "unknown shop currency #{inspect(currency)}")

  defp normalize_quest(id, quest, category) do
    %{
      id: id,
      name: quest["name"],
      category: String.to_atom(category),
      text: quest["text"],
      ranks: normalize_quest_ranks(id, quest["ranks"])
    }
  end

  defp normalize_quest_ranks(id, ranks) do
    for {rank_str, data} <- ranks, into: %{} do
      rank = String.to_integer(rank_str)

      {rank,
       %{
         requirement: normalize_quest_requirement(id, data["requirement"]),
         fame: BigNum.from_number(data["fame"]),
         favor: data["favor"] || 1
       }}
    end
  end

  defp normalize_quest_requirement(id, value) when id in ["coins", "shards", "cores"],
    do: BigNum.from_number(value)

  defp normalize_quest_requirement(_id, value), do: value

  defp normalize_achievement(achievement) do
    %{
      id: achievement["id"],
      name: achievement["name"],
      multiplier: achievement["multiplier"],
      condition: achievement["condition"],
      condition_text: achievement["condition_text"],
      favor: achievement["favor"] || 1
    }
  end
end
