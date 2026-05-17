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

  test "visible_quests/1 includes current active rank reward" do
    state = State.new(Incrementalist.Game.Time.now())
    
    # 1. Initially, level_up quest has claimed_rank = 0, so target rank is 1.
    # Level Up rank 1 reward is 5.
    visible = State.visible_quests(state.quests)
    assert Map.has_key?(visible, "level_up")
    assert visible["level_up"]["claimed_rank"] == 0
    assert BigNum.to_float(visible["level_up"]["reward"]) == 5.0

    # 2. Complete level_up up to rank 3
    state = %{state | level: 6000}
    evaluated = Rules.evaluate(state)
    
    # claimed_rank is still 0, so active rank is 1. Reward should still be for rank 1 (5.0)
    visible_eval = State.visible_quests(evaluated.quests)
    assert visible_eval["level_up"]["rank"] == 3
    assert visible_eval["level_up"]["claimed_rank"] == 0
    assert BigNum.to_float(visible_eval["level_up"]["reward"]) == 5.0

    # 3. Claim all completed ranks
    {:ok, claimed} = Rules.claim(evaluated, "level_up")
    
    # now claimed_rank is 3, max_rank is 4. Active rank should be 4.
    # Level Up rank 4 reward is 50.
    visible_claimed = State.visible_quests(claimed.quests)
    assert visible_claimed["level_up"]["claimed_rank"] == 3
    assert BigNum.to_float(visible_claimed["level_up"]["reward"]) == 50.0
  end
end
