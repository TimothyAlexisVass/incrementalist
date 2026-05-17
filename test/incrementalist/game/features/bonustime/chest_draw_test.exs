defmodule Incrementalist.Game.Features.BonusTime.ChestDrawTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.ChestDraw

  describe "roll_reward/1" do
    test "rolls 1 time on 0 streak" do
      # Seed to a known value so we know what to expect from uniform()
      :rand.seed(:exsss, {1, 2, 3})
      {tier, rolls} = ChestDraw.roll_reward(0)

      assert length(rolls) == 1
      assert tier in 1..7
    end

    test "adds 1 bonus roll per 60 streak" do
      :rand.seed(:exsss, {1, 2, 3})
      {_tier, rolls} = ChestDraw.roll_reward(60)
      assert length(rolls) == 2
    end

    test "caps bonus rolls at 2 (streak 120)" do
      :rand.seed(:exsss, {1, 2, 3})
      {_tier, rolls} = ChestDraw.roll_reward(120)
      assert length(rolls) == 3

      {_tier, rolls_higher} = ChestDraw.roll_reward(500)
      assert length(rolls_higher) == 3
    end

    test "returns the highest tier among the rolls" do
      :rand.seed(:exsss, {1, 2, 3})
      {tier, rolls} = ChestDraw.roll_reward(120)

      # Determine highest element in rolls
      highest = Enum.max(rolls)

      # Returned tier is index + 1
      assert tier == highest
    end
  end
end
