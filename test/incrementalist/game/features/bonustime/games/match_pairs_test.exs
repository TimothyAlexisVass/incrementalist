defmodule Incrementalist.Game.Features.BonusTime.Games.MatchPairsTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.MatchPairs

  test "claim_reward_tiers/1 falls back to tier 1 consolation when nothing completes" do
    assert MatchPairs.claim_reward_tiers([]) == [1]
    assert MatchPairs.claim_reward_tier([]) == 1
  end

  test "claim_reward_tiers/1 preserves completed tiers and claim_reward_tier/1 picks the highest" do
    completed_matches = ["tier_2", "tier_4", "tier_1"]

    assert MatchPairs.claim_reward_tiers(completed_matches) == [2, 4, 1]
    assert MatchPairs.claim_reward_tier(completed_matches) == 4
  end
end
