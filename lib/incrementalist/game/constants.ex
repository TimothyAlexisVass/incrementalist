defmodule Incrementalist.Game.Constants do
  @moduledoc """
  Centralizes magic numbers and domain limits.
  """

  @requirements_dir Path.expand("../../../shared/requirements", __DIR__)
  @areas_path Path.join(@requirements_dir, "areas.json")
  @sage_tip_levels_path Path.join(@requirements_dir, "sage-tip-levels.json")
  @shop_items_path Path.join(@requirements_dir, "shop-items.json")
  @quests_path Path.join(@requirements_dir, "quests.json")
  @external_resource @areas_path
  @external_resource @sage_tip_levels_path
  @external_resource @shop_items_path
  @external_resource @quests_path
  @areas @areas_path |> File.read!() |> Jason.decode!()
  @sage_tip_levels @sage_tip_levels_path |> File.read!() |> Jason.decode!()
  @shop_items @shop_items_path |> File.read!() |> Jason.decode!()
  @quests @quests_path |> File.read!() |> Jason.decode!()

  def max_save_slots, do: 4
  def valid_slot_indexes, do: 0..(max_save_slots() - 1)

  def max_queued_commands, do: 10
  def valid_command_ids, do: 0..(max_queued_commands() - 1)

  def area_defs do
    Enum.map(@areas, &normalize_area/1)
  end

  def shop_item_defs do
    Enum.map(@shop_items, &normalize_shop_item/1)
  end

  def quest_defs do
    for {category, quests} <- @quests, {id, quest} <- quests, into: %{} do
      {id, normalize_quest(id, quest, category)}
    end
  end

  # Progress Bar Constants
  def progress_bar_max_fill, do: 100.0
  def progress_bar_new_player_bonus_fill_multiplier, do: 2.5
  def progress_bar_new_player_bonus_fill_bonus, do: 20.0
  def progress_bar_late_new_player_bonus_fill_multiplier, do: 7.25
  def progress_bar_base_idle_mode_off_fill_rate, do: 0.8
  def progress_bar_base_idle_mode_on_fill_rate, do: 0.24
  def progress_bar_sisu_min_multiplier, do: 1.0
  def sisu_diminishment_reduction_factor_per_cycle, do: 0.98

  def charge_crystal_azure_claim_interval, do: 8
  def charge_crystal_aether_claim_interval, do: 50
  def charge_crystal_lucent_level_interval, do: 30
  def charge_crystal_transcendent_level_interval, do: 200

  # Notice IDs
  def notice_parent_menu_main, do: "parent.menu.main"
  def notice_parent_tab_shop, do: "parent.tab.shop"
  def notice_parent_area_dropdown, do: "parent.area.dropdown"

  def notice_leaf_area_dropdown_button, do: "leaf.area_dropdown.button"
  def notice_leaf_tab_shop_button, do: "leaf.tab.shop.button"
  def notice_leaf_tab_quest_button, do: "leaf.tab.quest.button"
  def notice_leaf_tab_achievements_button, do: "leaf.tab.achievements.button"
  def notice_leaf_tab_menu_any_button, do: "leaf.tab.menu.any.button"

  def sage_tip_levels do
    @sage_tip_levels
  end

  defp normalize_area(%{"key" => key, "name" => name, "description" => description, "unlock_level" => unlock_level}) do
    %{
      key: key,
      name: name,
      description: description,
      unlock_level: unlock_level
    }
  end

  defp normalize_shop_item(%{"id" => id, "name" => name, "description" => description, "cost" => cost, "currency" => currency, "required_level" => required_level}) do
    %{
      id: id,
      name: name,
      description: description,
      cost: BigNum.normalize(%BigNum{m: cost["m"], e: cost["e"]}),
      currency: normalize_shop_currency(currency),
      required_level: required_level
    }
  end

  defp normalize_shop_currency("coins"), do: :coins
  defp normalize_shop_currency("shards"), do: :shards
  defp normalize_shop_currency("cores"), do: :cores
  defp normalize_shop_currency(currency), do: raise(ArgumentError, "unknown shop currency #{inspect(currency)}")

  defp normalize_quest(id, quest, category) do
    %{
      id: id,
      name: quest["name"],
      category: String.to_atom(category),
      ranks: normalize_quest_ranks(id, quest["ranks"])
    }
  end

  defp normalize_quest_ranks(id, ranks) do
    for {rank_str, data} <- ranks, into: %{} do
      rank = String.to_integer(rank_str)
      {rank, %{
        requirement: normalize_quest_requirement(id, data["requirement"]),
        reward: BigNum.from_number(data["reward"])
      }}
    end
  end

  defp normalize_quest_requirement(id, value) when id in ["coins", "shards", "cores"], do: BigNum.from_number(value)
  defp normalize_quest_requirement(_id, value), do: value

end
