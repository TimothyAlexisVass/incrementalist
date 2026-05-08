defmodule Incrementalist.Game.Rewards do
  @moduledoc """
  Centralized reward handler to process EXP gains, level-ups, and currency mutations consistently.
  """
  alias Incrementalist.Game.State

  def apply_level_ups(%State{} = state) do
    level = state.level || 1
    exp = state.exp || 0
    coins = state.coins || 0
    shards = state.shards || 0
    cores = state.cores || 0

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

    if exp >= required_exp do
      new_exp = exp - required_exp
      new_level = level + 1
      {reward_coins, reward_shards, reward_cores} = get_level_up_rewards(new_level)

      do_apply_level_ups(
        new_level,
        new_exp,
        coins + reward_coins,
        shards + reward_shards,
        cores + reward_cores
      )
    else
      {level, exp, coins, shards, cores}
    end
  end

  defp calculate_required_exp(level) do
    level * level * 10 + 10
  end

  defp get_level_up_rewards(level) do
    shards = level
    cores = 0

    {shards, cores} =
      cond do
        rem(level, 1000) == 0 -> {shards, level}
        rem(level, 100) == 0 -> {shards * 10, cores}
        true -> {shards, cores}
      end

    coins = 200 * level
    {coins, shards, cores}
  end
end
