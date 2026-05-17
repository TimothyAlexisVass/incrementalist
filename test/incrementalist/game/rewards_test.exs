defmodule Incrementalist.Game.RewardsTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Rewards

  describe "apply_level_ups/1" do
    test "does not level up if exp < required_exp" do
      # Level 1 needs 20.
      state = %State{level: 1, exp: BigNum.from_number(5), required_exp: BigNum.from_number(20)}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 1
      assert BigNum.compare(new_state.exp, BigNum.from_number(5)) == 0
    end

    test "levels up when exp >= required_exp" do
      # Level 1 requires 20. We give 25 exp.
      state = %State{level: 1, exp: BigNum.from_number(25), required_exp: BigNum.from_number(20)}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 2
      # 25 - 20 = 5 exp remaining
      assert BigNum.compare(new_state.exp, BigNum.from_number(5)) == 0
      # Level 2 required_exp: 10.1 * 4 + 9 = 49.4, snapped to 50.
      assert BigNum.compare(new_state.required_exp, BigNum.from_number(50)) == 0
    end

    test "levels up multiple times" do
      # Level 1 needs 20, Level 2 needs 50. Total 70.
      state = %State{level: 1, exp: BigNum.from_number(80), required_exp: BigNum.from_number(20)}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 3
      # 80 - 20 - 50 = 10 exp remaining
      assert BigNum.compare(new_state.exp, BigNum.from_number(10)) == 0
    end

    test "keeps required_exp below 1000 on a multiple of 10" do
      state = %State{level: 8, exp: BigNum.from_number(660), required_exp: BigNum.from_number(660)}
      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 9
      assert BigNum.compare(new_state.required_exp, BigNum.from_number(830)) == 0
    end

    test "level 100 rewards" do
      # Level 99 needs 10.1 * 99^2 + 9 = 10.1 * 9801 + 9 = 98999.1
      req = BigNum.from_number(98999.1)
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

    test "awards lucent and transcendent charge crystals on milestone levels" do
      req = BigNum.from_number(3623899.1)

      state = %State{
        level: 599,
        exp: req,
        coins: BigNum.zero(),
        shards: BigNum.zero(),
        cores: BigNum.zero(),
        required_exp: req,
        charge_crystals: %State.ChargeCrystals{}
      }

      new_state = Rewards.apply_level_ups(state)

      assert new_state.level == 600
      assert new_state.charge_crystals.lucent == 1
      assert new_state.charge_crystals.transcendent == 1
      assert new_state.charge_crystals.azure == 0
      assert new_state.charge_crystals.aether == 0
    end
  end
end
