defmodule Incrementalist.Game.Features.Progress.BarTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Features.Progress.Bar

  describe "claim_reward/1" do
    test "deterministic RNG for coins and shards" do
      # Seed the process dictionary to ensure predictable :rand.uniform() calls
      :rand.seed(:exsss, {1, 2, 3})

      # Level 2 ensures we use the random paths (Level 1 has hardcoded values)
      state = %State{
        level: 2,
        exp: 0,
        coins: 0,
        shards: 0,
        cores: 0,
        progress_bar: %State.ProgressBar{
          sisu: 1,
          reward_multiplier: 1.0
        }
      }

      # Call claim_reward. Note: we don't pass random_fn, it defaults to &rand/0.
      # By seeding the process, rand() is deterministic.
      result1 = Bar.claim_reward(state)
      
      # Since it's deterministic, calling it again with the same initial seed state
      # would yield the exact same result. Instead, we just verify it produced expected values.
      assert result1.coins > 0
      assert result1.shards > 0
      
      # Let's seed again with the exact same seed and ensure we get the exact same result
      :rand.seed(:exsss, {1, 2, 3})
      result2 = Bar.claim_reward(state)
      
      assert result1.coins == result2.coins
      assert result1.shards == result2.shards
      assert result1.cores == result2.cores
      assert result1.exp == result2.exp
    end
  end
end
