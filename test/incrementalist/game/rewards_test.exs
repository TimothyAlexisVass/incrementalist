defmodule Incrementalist.Game.RewardsTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Rewards

  describe "apply_level_ups/1" do
    test "does not level up if exp < required_exp" do
      # Level 1 needs 19.1
      state = %State{level: 1, exp: BigNum.from_number(5), required_exp: BigNum.from_number(19.1)}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 1
      assert BigNum.compare(new_state.exp, BigNum.from_number(5)) == 0
    end

    test "levels up when exp >= required_exp" do
      # Level 1 requires 19.1. We give 25 exp.
      state = %State{level: 1, exp: BigNum.from_number(25), required_exp: BigNum.from_number(19.1)}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 2
      # 25 - 19.1 = 5.9 exp remaining
      assert BigNum.compare(new_state.exp, BigNum.from_number(5.9)) == 0
      # Level 2 required_exp: 10.1 * 4 + 9 = 49.4
      assert BigNum.compare(new_state.required_exp, BigNum.from_number(49.4)) == 0
    end

    test "levels up multiple times" do
      # Level 1 needs 19.1, Level 2 needs 49.4. Total 68.5.
      state = %State{level: 1, exp: BigNum.from_number(80), required_exp: BigNum.from_number(19.1)}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 3
      # 80 - 19.1 - 49.4 = 11.5 exp remaining
      assert BigNum.compare(new_state.exp, BigNum.from_number(11.5)) == 0
    end

    test "level 100 rewards" do
      # Level 99 needs 10.1 * 99^2 + 9 = 10.1 * 9801 + 9 = 98989.1 + 9 = 99008.1
      req = BigNum.from_number(99008.1)
      state = %State{level: 99, exp: req, coins: BigNum.zero(), shards: BigNum.zero(), cores: BigNum.zero(), required_exp: req}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 100
      assert BigNum.compare(new_state.coins, BigNum.from_number(20000)) == 0
      assert BigNum.compare(new_state.shards, BigNum.from_number(1000)) == 0
    end

    test "level 1000 rewards" do
      # Level 999 needs 10.1 * 999^2 + 9 = 10.1 * 998001 + 9 = 10079810.1 + 9 = 10079819.1
      req = BigNum.from_number(10079819.1)
      state = %State{level: 999, exp: req, coins: BigNum.zero(), shards: BigNum.zero(), cores: BigNum.zero(), required_exp: req}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 1000
      assert BigNum.compare(new_state.coins, BigNum.from_number(200_000)) == 0
      assert BigNum.compare(new_state.shards, BigNum.from_number(1000)) == 0
      assert BigNum.compare(new_state.cores, BigNum.from_number(1000)) == 0
    end
  end
end
