defmodule Incrementalist.Game.Features.BonusTime.Games.ScratchCardTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.BonusTime.Games.ScratchCard
  alias Incrementalist.Game.Time

  test "roll_reward/3 generates a sorted reveal schedule within budget and spacing rules" do
    now = Time.now()
    rules = Constants.bonustime_game_rules()["scratch_card"]
    board_size = Map.fetch!(rules, "board_size")
    board_pixels = board_size["width"] * board_size["height"]
    min_gap_pixels = rules["reveal_schedule"]["min_threshold_gap_pixels"]
    reward_cap = trunc(rules["reward_count"]["max_scale_base"])

    {pixels_budget, reveal_schedule} = ScratchCard.roll_reward(0, 0, now)

    assert pixels_budget in trunc(board_pixels * 0.10)..trunc(board_pixels * 0.16)
    assert length(reveal_schedule) >= 1
    assert length(reveal_schedule) <= reward_cap
    assert reveal_schedule == Enum.sort_by(reveal_schedule, & &1.pixels)

    assert Enum.all?(reveal_schedule, fn reveal ->
             reveal.pixels >= 1 and reveal.pixels <= pixels_budget and reveal.tier in 1..7
           end)
    assert hd(reveal_schedule).pixels <= min_gap_pixels

    reveal_schedule
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.each(fn [left, right] ->
      assert right.pixels - left.pixels >= min_gap_pixels
    end)

    last_reveal = List.last(reveal_schedule)
    assert last_reveal.pixels <= max(1, pixels_budget - min_gap_pixels)
  end

  test "roll_reward/3 applies streak bonus to the scratch budget range" do
    now = Time.now()
    rules = Constants.bonustime_game_rules()["scratch_card"]
    board_size = Map.fetch!(rules, "board_size")
    board_pixels = board_size["width"] * board_size["height"]
    per_day_bonus = rules["pixel_budget"]["streak_scaling"]["per_day"]
    max_bonus = rules["pixel_budget"]["streak_scaling"]["max_bonus"]
    streak = 300
    streak_bonus = min(max_bonus, streak * per_day_bonus)
    min_ratio = rules["pixel_budget"]["rand_min"] + streak_bonus
    max_ratio = rules["pixel_budget"]["rand_max"] + streak_bonus

    {pixels_budget, reveal_schedule} = ScratchCard.roll_reward(streak, 0, now)

    assert pixels_budget in trunc(board_pixels * min_ratio)..trunc(board_pixels * max_ratio)
    assert length(reveal_schedule) >= 1
  end
end
