defmodule Incrementalist.Game.RewardsTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Rewards

  describe "apply_level_ups/1" do
    test "does not level up if exp < required_exp" do
      state = %State{level: 1, exp: 5, required_exp: 20}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 1
      assert new_state.exp == 5
      assert new_state.coins == 0
      assert new_state.shards == 0
      assert new_state.cores == 0
    end

    test "levels up when exp >= required_exp" do
      # Level 1 requires 20 exp. We give 25 exp.
      state = %State{level: 1, exp: 25, required_exp: 20}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 2
      # 25 - 20 = 5 exp remaining
      assert new_state.exp == 5
      # Level 2 required_exp: (2*2)*10 + 10 = 50
      assert new_state.required_exp == 50

      # Level 2 rewards: coins = 200 * 2 = 400. Shards = 2. Cores = 0.
      assert new_state.coins == 400
      assert new_state.shards == 2
      assert new_state.cores == 0
    end

    test "levels up multiple times" do
      # Level 1 needs 20, Level 2 needs 50. Total 70.
      state = %State{level: 1, exp: 80, required_exp: 20}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 3
      # 80 - 20 - 50 = 10 exp remaining
      assert new_state.exp == 10
      assert new_state.required_exp == 100

      # Level 2 rewards: 400 coins, 2 shards, 0 cores.
      # Level 3 rewards: 600 coins, 3 shards, 0 cores.
      # Total: 1000 coins, 5 shards.
      assert new_state.coins == 1000
      assert new_state.shards == 5
      assert new_state.cores == 0
    end

    test "level 100 rewards" do
      # 100 requires 100,010 exp. Let's start at 99.
      # Level 99 needs 98020.
      state = %State{level: 99, exp: 98020, coins: 0, shards: 0, cores: 0, required_exp: 98020}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 100
      # Level 100 rewards: 200 * 100 = 20000 coins
      # Shards = 100 * 10 = 1000 (because % 100 == 0)
      # Cores = 0
      assert new_state.coins == 20000
      assert new_state.shards == 1000
      assert new_state.cores == 0
    end

    test "level 1000 rewards" do
      state = %State{level: 999, exp: 9980020, coins: 0, shards: 0, cores: 0, required_exp: 9980020}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 1000
      # Level 1000 rewards: coins = 200,000
      # Shards = 1000 (wait, if % 1000 == 0, it gives cores, not 10x shards)
      assert new_state.coins == 200_000
      assert new_state.shards == 1000
      assert new_state.cores == 1000
    end
  end
end
