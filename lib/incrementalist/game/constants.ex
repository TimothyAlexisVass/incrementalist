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
  def progress_bar_new_player_bonus_window_ms, do: 25_000
  def progress_bar_new_player_bonus_fill_multiplier, do: 2.5
  def progress_bar_new_player_bonus_fill_bonus, do: 20.0
  def progress_bar_late_new_player_bonus_fill_multiplier, do: 7.25
  def progress_bar_base_idle_mode_off_fill_rate, do: 0.8
  def progress_bar_base_idle_mode_on_fill_rate, do: 0.24
  def progress_bar_sisu_min_multiplier, do: 1.0
end
