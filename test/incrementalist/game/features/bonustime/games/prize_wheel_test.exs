defmodule Incrementalist.Game.Features.BonusTime.Games.PrizeWheelTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.PrizeWheel

  test "roll_reward/1 scales number of rolls based on streak" do
    # Streak 0: min(2, 0/30) = 0 bonus rolls, so 1 roll total.
    {_tier, rolls} = PrizeWheel.roll_reward(0)
    assert length(rolls) == 1

    # Streak 29: min(2, 29/30) = 0 bonus rolls, so 1 roll total.
    {_tier, rolls} = PrizeWheel.roll_reward(29)
    assert length(rolls) == 1

    # Streak 30: min(2, 30/30) = 1 bonus roll, so 2 rolls total.
    {_tier, rolls} = PrizeWheel.roll_reward(30)
    assert length(rolls) == 2

    # Streak 59: min(2, 59/30) = 1 bonus roll, so 2 rolls total.
    {_tier, rolls} = PrizeWheel.roll_reward(59)
    assert length(rolls) == 2

    # Streak 60: min(2, 60/30) = 2 bonus rolls, so 3 rolls total.
    {_tier, rolls} = PrizeWheel.roll_reward(60)
    assert length(rolls) == 3

    # Streak 100 (capped at max 2 bonus rolls): min(2, 100/30) = 2 bonus rolls, so 3 rolls total.
    {_tier, rolls} = PrizeWheel.roll_reward(100)
    assert length(rolls) == 3
  end

  test "roll_reward/1 outcomes are strictly valid tiers between 1 and 7" do
    for streak <- [0, 45, 90] do
      {tier, rolls} = PrizeWheel.roll_reward(streak)
      assert tier >= 1 and tier <= 7
      assert Enum.all?(rolls, fn r -> r >= 1 and r <= 7 end)
      assert tier == Enum.max(rolls)
    end
  end
end
