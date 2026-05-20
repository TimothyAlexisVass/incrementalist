defmodule Incrementalist.Game.Features.BonusTime.Games.LadderClimbTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.BonusTime.Games.LadderClimb
  alias Incrementalist.Game.Time

  test "roll_reward/3 returns rung metadata and caps rewards at tier 7" do
    rules = Constants.bonustime_game_rules()["ladder_climb"]
    visible_rungs = Map.fetch!(rules, "visible_rungs")
    reward_cap_rung = Map.fetch!(rules, "reward_cap_rung")
    now = Time.now()

    :rand.seed(:exsss, {101, 102, 103})
    {tier, path} = LadderClimb.roll_reward(0, 0, now)

    assert is_integer(tier)
    assert tier in 1..reward_cap_rung
    assert is_list(path)
    assert length(path) >= 1
    assert length(path) <= visible_rungs - 1

    Enum.each(path, fn step ->
      assert is_integer(step["from_rung"])
      assert is_integer(step["target_rung"])
      assert step["target_rung"] == step["from_rung"] + 1
      assert step["reached_rung"] in [step["from_rung"], step["target_rung"]]
      assert is_boolean(step["success"])
      assert step["chance"] >= 0.0
      assert step["chance"] <= 1.0
    end)

    assert tier == min(highest_rung(path), reward_cap_rung)
  end

  test "roll_reward/3 keeps the same random seed path from getting worse with streak bonus" do
    now = Time.now()
    seed = {201, 202, 203}

    :rand.seed(:exsss, seed)
    {tier_zero, path_zero} = LadderClimb.roll_reward(0, 0, now)

    :rand.seed(:exsss, seed)
    {tier_bonus, path_bonus} = LadderClimb.roll_reward(60, 0, now)

    assert tier_bonus >= tier_zero
    assert highest_rung(path_bonus) >= highest_rung(path_zero)
  end

  defp highest_rung(path) do
    path
    |> List.last()
    |> Map.fetch!("reached_rung")
  end
end
