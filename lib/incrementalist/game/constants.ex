defmodule Incrementalist.Game.Constants do
  @moduledoc """
  Centralizes magic numbers and domain limits.
  """

  def max_save_slots, do: 4
  def valid_slot_indexes, do: 0..(max_save_slots() - 1)

  def max_queued_commands, do: 10
  def valid_command_ids, do: 0..(max_queued_commands() - 1)

  def area_defs do
    [
      %{
        key: "sage",
        name: "The Sage",
        description: "A quiet, ancient place of wisdom where growth begins.",
        unlock_level: 1
      },
      %{
        key: "cloverfield",
        name: "Cloverfield",
        description: "A lush field where luck intertwines with every step.",
        unlock_level: 10
      },
      %{
        key: "market",
        name: "The Market",
        description: "A bustling market to trade your hard earned goods.",
        unlock_level: 15
      }
    ]
  end

  def shop_item_defs do
    [
      %{
        id: "idle_mode",
        name: "Idle Mode",
        description: "Allows you to claim rewards automatically, but slowly!",
        cost: BigNum.from_number(500),
        currency: :coins,
        required_level: 2,
        unlocks: [:world_map]
      },
      %{
        id: "sisu_generator",
        name: "Sisu Generator",
        description: "Refill Sisu and upgrade Max Sisu!",
        cost: BigNum.from_number(2000),
        currency: :coins,
        required_level: 4,
        unlocks: []
      },
      %{
        id: "bonus_time",
        name: "BONUSTIME",
        description: "Play daily bonus games when a daily token is ready!",
        cost: BigNum.from_number(1000),
        currency: :shards,
        required_level: 15,
        unlocks: []
      }
    ]
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

  # Notice IDs
  def notice_parent_menu_main, do: "parent.menu.main"
  def notice_parent_tab_shop, do: "parent.tab.shop"
  def notice_parent_area_dropdown, do: "parent.area.dropdown"

  def notice_leaf_area_dropdown_button, do: "leaf.area_dropdown.button"
  def notice_leaf_tab_shop_button, do: "leaf.tab.shop.button"
  def notice_leaf_tab_quest_button, do: "leaf.tab.quest.button"
  def notice_leaf_tab_achievements_button, do: "leaf.tab.achievements.button"
  def notice_leaf_tab_menu_any_button, do: "leaf.tab.menu.any.button"

  def sage_tip_levels, do: [1, 2, 4, 10, 15]
end
