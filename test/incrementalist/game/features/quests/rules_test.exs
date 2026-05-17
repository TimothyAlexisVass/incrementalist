defmodule Incrementalist.Game.Features.Quests.RulesTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.Quests.Rules
  alias Incrementalist.Game.State

  test "evaluate sets rank properly and claim grants all accumulated rewards" do
    state = State.new(Incrementalist.Game.Time.now())
    # 6000 levels is enough to satisfy rank 1 (2 levels), rank 2 (1000 levels), and rank 3 (5000 levels)
    # Rewards are 5, 15, and 30 respectively.
    state = %{state | level: 6000}

    evaluated = Rules.evaluate(state)
    level_up_quest = Enum.find(evaluated.quests, &(&1.id == "level_up"))

    assert level_up_quest.rank == 3
    assert level_up_quest.claimed_rank == 0

    {:ok, claimed} = Rules.claim(evaluated, "level_up")
    claimed_quest = Enum.find(claimed.quests, &(&1.id == "level_up"))

    assert claimed_quest.claimed_rank == 3

    # Check total coins earned: 5 + 15 + 30 = 50
    assert BigNum.to_float(claimed.coins) == 50.0
    assert BigNum.to_float(claimed.stats.total_coins_earned) == 50.0
    assert claimed.stats.total_quests_claimed == 3
  end
end
