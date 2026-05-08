defmodule Incrementalist.Game.Rewards do
  @moduledoc """
  Centralized reward handler to process EXP gains, level-ups, and currency mutations consistently.
  """
  alias Incrementalist.Game.State

  def apply_level_ups(%State{} = state) do
    level = state.level || 1
    exp = state.exp || BigNum.zero()
    coins = state.coins || BigNum.zero()
    shards = state.shards || BigNum.zero()
    cores = state.cores || BigNum.zero()

    {new_level, new_exp, new_coins, new_shards, new_cores} =
      do_apply_level_ups(level, exp, coins, shards, cores)

    %{
      state
      | level: new_level,
        exp: new_exp,
        coins: new_coins,
        shards: new_shards,
        cores: new_cores,
        required_exp: calculate_required_exp(new_level)
    }
  end

  defp do_apply_level_ups(level, exp, coins, shards, cores) do
    required_exp = calculate_required_exp(level)

    if BigNum.compare(exp, required_exp) >= 0 do
      new_exp = BigNum.sub(exp, required_exp)
      new_level = level + 1
      {reward_coins, reward_shards, reward_cores} = get_level_up_rewards(new_level)

      do_apply_level_ups(
        new_level,
        new_exp,
        BigNum.add(coins, reward_coins),
        BigNum.add(shards, reward_shards),
        BigNum.add(cores, reward_cores)
      )
    else
      {level, exp, coins, shards, cores}
    end
  end

  defp calculate_required_exp(level) do
    # Sync with frontend: 10.1 * level^2 + 9
    base = BigNum.from_number(level)
    term1 = BigNum.mul(BigNum.from_number(10.1), BigNum.pow(base, 2))
    BigNum.add(term1, BigNum.from_number(9))
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
end

