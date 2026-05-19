defmodule Incrementalist.Game.Features.BonusTime.Games.RewardLabyrinthTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.RewardLabyrinth
  alias Incrementalist.Game.Time

  test "roll_reward/3 generates a correct labyrinth steps and chests" do
    now = Time.now()
    {steps_total, chests} = RewardLabyrinth.roll_reward(0, 0, now)

    # Base steps should be in 4..10
    assert steps_total >= 4 and steps_total <= 10
    assert length(chests) >= 2
    assert length(chests) <= steps_total

    for chest <- chests do
      assert chest.step in 1..steps_total
      assert chest.tier in 1..7
    end
  end

  test "roll_reward/3 scales steps and chests based on streak" do
    now = Time.now()

    # streak 0 => 4..10 steps
    {steps_0, chests_0} = RewardLabyrinth.roll_reward(0, 0, now)
    assert steps_0 >= 4 and steps_0 <= 10
    assert length(chests_0) >= 2

    # streak 300 => (4..10) + 20 steps => 24..30 steps
    {steps_300, chests_300} = RewardLabyrinth.roll_reward(300, 0, now)
    assert steps_300 >= 24 and steps_300 <= 30
    assert length(chests_300) >= 2
  end
end
