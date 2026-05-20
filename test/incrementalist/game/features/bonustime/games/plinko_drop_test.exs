defmodule Incrementalist.Game.Features.BonusTime.Games.PlinkoDropTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Features.BonusTime.Games.PlinkoDrop

  test "roll_reward/1 scales drop count with streak and caps at configured max" do
    {_tier, _best_rolls, plinko} = PlinkoDrop.roll_reward(0)
    assert length(plinko["drops"]) == 1

    {_tier, _best_rolls, plinko} = PlinkoDrop.roll_reward(44)
    assert length(plinko["drops"]) == 1

    {_tier, _best_rolls, plinko} = PlinkoDrop.roll_reward(45)
    assert length(plinko["drops"]) == 2

    {_tier, _best_rolls, plinko} = PlinkoDrop.roll_reward(89)
    assert length(plinko["drops"]) == 2

    {_tier, _best_rolls, plinko} = PlinkoDrop.roll_reward(90)
    assert length(plinko["drops"]) == 3

    {_tier, _best_rolls, plinko} = PlinkoDrop.roll_reward(300)
    assert length(plinko["drops"]) == 3
  end

  test "roll_reward/1 returns valid authoritative bounce rolls and tiers" do
    {tier, best_rolls, plinko} = PlinkoDrop.roll_reward(90)

    assert tier >= 1 and tier <= 7
    assert is_list(best_rolls)
    assert length(best_rolls) == plinko["rows"]
    assert hd(best_rolls) == true
    assert Enum.all?(best_rolls, &is_boolean/1)

    assert plinko["rows"] == 13
    assert plinko["lanes"] == 7
    assert is_integer(plinko["best_drop_index"])
    assert plinko["best_drop_index"] >= 0
    assert plinko["best_drop_index"] < length(plinko["drops"])
    assert tier == Enum.max(Enum.map(plinko["drops"], & &1["tier"]))
    assert best_rolls == Enum.at(plinko["drops"], plinko["best_drop_index"])["rolls"]

    assert Enum.all?(plinko["drops"], fn drop ->
             drop_rolls = drop["rolls"]
             true_count = Enum.count(drop_rolls, & &1)
             tier_value = drop["tier"]

             is_list(drop_rolls) and
               length(drop_rolls) == plinko["rows"] and
               hd(drop_rolls) == true and
               Enum.all?(drop_rolls, &is_boolean/1) and
               drop["true_count"] == true_count and
               tier_value == true_count - 6 and
               tier_value >= 1 and
               tier_value <= 7 and
               drop["landing_lane"] == tier_value - 1 and
               drop["landing_lane"] >= 0 and
               drop["landing_lane"] < plinko["lanes"]
           end)
  end

  test "roll_reward/1 never emits left bounce at column 0 after first bounce" do
    {_tier, _best_rolls, plinko} = PlinkoDrop.roll_reward(90)

    assert Enum.all?(plinko["drops"], fn drop ->
             rolls = drop["rolls"]

             {_position, valid?} =
               Enum.reduce(Enum.with_index(rolls), {0.0, true}, fn {roll, step}, {position, ok} ->
                 left_at_zero? = step > 0 and roll == false and position == 0.0

                 next_position =
                   max(0.0, min(plinko["lanes"] * 1.0, position + if(roll, do: 0.5, else: -0.5)))

                 {next_position, ok and not left_at_zero?}
               end)

             valid?
           end)
  end
end
