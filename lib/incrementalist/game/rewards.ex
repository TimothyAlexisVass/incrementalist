defmodule Incrementalist.Game.Rewards do
  @moduledoc """
  Centralized reward handler to process EXP gains, level-ups, and currency mutations consistently.
  """
  alias Incrementalist.Game.Features.Progress.ChargeCrystals
  alias Incrementalist.Game.State

  def apply_level_ups(%State{} = state) do
    level = state.level || 1
    exp = state.exp || BigNum.zero()
    coins = state.coins || BigNum.zero()
    shards = state.shards || BigNum.zero()
    cores = state.cores || BigNum.zero()
    charge_crystals = ChargeCrystals.normalize(state.charge_crystals)

    {new_level, new_exp, new_coins, new_shards, new_cores, new_charge_crystals, level_ups,
     gained_coins, gained_shards, gained_cores} =
      do_apply_level_ups(level, exp, coins, shards, cores, charge_crystals, 0, BigNum.zero(),
        BigNum.zero(), BigNum.zero())

    stats = state.stats || %State.Stats{}

    new_stats = %{
      stats
      | total_level_ups_daily: stats.total_level_ups_daily + level_ups,
        total_coins_earned: BigNum.add(stats.total_coins_earned || BigNum.zero(), gained_coins),
        total_shards_earned: BigNum.add(stats.total_shards_earned || BigNum.zero(), gained_shards),
        total_cores_earned: BigNum.add(stats.total_cores_earned || BigNum.zero(), gained_cores)
    }

    %{
      state
      | level: new_level,
        exp: new_exp,
        coins: new_coins,
        shards: new_shards,
        cores: new_cores,
        charge_crystals: new_charge_crystals,
        required_exp: calculate_required_exp(new_level),
        stats: new_stats
    }
  end

  defp do_apply_level_ups(level, exp, coins, shards, cores, charge_crystals, level_ups,
         gained_coins, gained_shards, gained_cores) do
    required_exp = calculate_required_exp(level)

    if BigNum.compare(exp, required_exp) >= 0 do
      new_exp = BigNum.sub(exp, required_exp)
      new_level = level + 1
      {reward_coins, reward_shards, reward_cores} = get_level_up_rewards(new_level)
      new_charge_crystals = ChargeCrystals.grant_level_up(charge_crystals, new_level)

      do_apply_level_ups(
        new_level,
        new_exp,
        BigNum.add(coins, reward_coins),
        BigNum.add(shards, reward_shards),
        BigNum.add(cores, reward_cores),
        new_charge_crystals,
        level_ups + 1,
        BigNum.add(gained_coins, reward_coins),
        BigNum.add(gained_shards, reward_shards),
        BigNum.add(gained_cores, reward_cores)
      )
    else
      {level, exp, coins, shards, cores, charge_crystals, level_ups, gained_coins, gained_shards,
       gained_cores}
    end
  end

  defp calculate_required_exp(level) do
    # Sync with frontend: 10.1 * level^2 + 9
    base = BigNum.from_number(level)
    term1 = BigNum.mul(BigNum.from_number(10.1), BigNum.pow(base, 2))
    term1
    |> BigNum.add(BigNum.from_number(9))
    |> snap_small_required_exp()
  end

  defp snap_small_required_exp(%BigNum{} = required_exp) do
    # Keep early-game requirements on clean tens so the server snapshot and HUD projection stay in sync.
    if BigNum.compare(required_exp, BigNum.from_number(1000)) < 0 do
      rounded_requirement = round(BigNum.to_float(required_exp) / 10) * 10
      BigNum.from_number(rounded_requirement)
    else
      required_exp
    end
  end

  defp get_level_up_rewards(level) do
    shards = BigNum.from_number(level)
    cores = BigNum.zero()

    {shards, cores} =
      cond do
        rem(level, 1000) == 0 -> {shards, BigNum.from_number(level)}
        rem(level, 100) == 0 -> {BigNum.mul(shards, BigNum.from_number(10)), cores}
        true -> {shards, cores}
      end

    coins = BigNum.mul(BigNum.from_number(200), BigNum.from_number(level))
    {coins, shards, cores}
  end

  def grant_bonus_reward(%State{} = state, tier_index) do
    # Tiers are 1-7.
    # Formula: level * 1000 * tier_multiplier
    level = state.level || 1
    multiplier = case tier_index do
      1 -> 1.0
      2 -> 2.5
      3 -> 6.0
      4 -> 15.0
      5 -> 40.0
      6 -> 100.0
      7 -> 500.0
      _ -> 1.0
    end

    amount_f = level * 1000 * multiplier
    reward_coins = BigNum.from_number(amount_f)

    new_coins = BigNum.add(state.coins || BigNum.zero(), reward_coins)
    
    stats = state.stats || %State.Stats{}
    new_stats = %{
      stats |
      total_coins_earned: BigNum.add(stats.total_coins_earned || BigNum.zero(), reward_coins)
    }

    new_state = %{state | coins: new_coins, stats: new_stats}
    {new_state, reward_coins}
  end
end
