defmodule Incrementalist.Game.Features.BonusTime.Games.RewardLabyrinthTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.BonusTime.Games.RewardLabyrinth
  alias Incrementalist.Game.Time

  test "roll_reward/3 generates a correct labyrinth steps and chests" do
    now = Time.now()
    rules = Constants.bonustime_game_rules()["reward_labyrinth"]
    step_budget = Map.fetch!(rules, "step_budget")
    chest_count = Map.fetch!(rules, "chest_count")

    {steps_total, chests} = RewardLabyrinth.roll_reward(0, 0, now)
    chances = Map.fetch!(rules, "chances")

    assert steps_total in Map.fetch!(step_budget, "base_min")..Map.fetch!(step_budget, "base_max")
    assert is_list(chances)
    assert length(chances) == 7
    assert length(chests) >= Map.fetch!(chest_count, "base_min")
    assert length(chests) <= steps_total

    for chest <- chests do
      assert chest.step in 1..steps_total
      assert chest.tier in 1..7
    end
  end

  test "roll_reward/3 scales steps and chests based on streak" do
    now = Time.now()
    rules = Constants.bonustime_game_rules()["reward_labyrinth"]
    step_budget = Map.fetch!(rules, "step_budget")
    streak_scaling = Map.fetch!(step_budget, "streak_scaling")
    chest_count = Map.fetch!(rules, "chest_count")
    streak_bonus = min(div(300, Map.fetch!(streak_scaling, "interval")), Map.fetch!(streak_scaling, "max_bonus"))
    base_min = Map.fetch!(step_budget, "base_min")
    base_max = Map.fetch!(step_budget, "base_max")

    {steps_0, chests_0} = RewardLabyrinth.roll_reward(0, 0, now)
    assert steps_0 in base_min..base_max
    assert length(chests_0) >= Map.fetch!(chest_count, "base_min")

    {steps_300, chests_300} = RewardLabyrinth.roll_reward(300, 0, now)
    assert steps_300 in (base_min + streak_bonus)..(base_max + streak_bonus)
    assert length(chests_300) >= Map.fetch!(chest_count, "base_min")
  end
end
