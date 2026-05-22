defmodule Incrementalist.Game.Features.BonusTime.Games.HammerSmash do
  @moduledoc """
  Hammer Smash daily bonus mini-game rules.

  The server rolls three smash powers in one shot plus an optional bell-break
  extra. The client only replays the stored result.
  """

  alias Incrementalist.Game.Constants

  @max_power 100

  def roll_reward(streak) do
    min_power = min_smash_power(streak)

    smash_1 = roll_smash_power(min_power)
    smash_2 = roll_smash_power(min_power)
    smash_3 = roll_smash_power(min_power)
    total = smash_1 + smash_2 + smash_3

    {base_tier, bell?} = reward_for_total_power(total)

    {extra_smash, bell_extra_tier} =
      if bell? do
        extra = roll_smash_power(min_power)
        {extra, bell_reward_for_extra_power(extra)}
      else
        {nil, nil}
      end

    best_tier = if bell_extra_tier, do: bell_extra_tier, else: base_tier

    smash_result = %{
      "smash_1_power" => smash_1,
      "smash_2_power" => smash_2,
      "smash_3_power" => smash_3,
      "extra_smash_power" => extra_smash,
      "bell_extra_tier" => bell_extra_tier
    }

    {best_tier, smash_result}
  end

  def min_smash_power(streak) do
    normalized = max(0, streak)
    capped = min(normalized, rules_streak_cap())
    1 + floor(capped * rules_streak_factor())
  end

  defp roll_smash_power(min_power) do
    Enum.random(min_power..@max_power)
  end

  defp reward_for_total_power(total) do
    rules = rules()
    bell_threshold = Map.fetch!(rules, "bell_threshold")
    tier_thresholds = Map.fetch!(rules, "tier_thresholds")

    cond do
      total >= bell_threshold ->
        {6, true}

      true ->
        tier =
          tier_thresholds
          |> Enum.with_index(2)
          |> Enum.reverse()
          |> Enum.find_value(1, fn {threshold, tier_num} ->
            if total >= threshold, do: tier_num
          end)

        {tier, false}
    end
  end

  defp bell_reward_for_extra_power(extra) do
    thresholds = Map.fetch!(rules(), "bell_break_thresholds")

    # thresholds = [50, 75, 91] mapping to tiers [5, 6, 7], default 4
    thresholds
    |> Enum.with_index(5)
    |> Enum.reverse()
    |> Enum.find_value(4, fn {threshold, tier_num} ->
      if extra >= threshold, do: tier_num
    end)
  end

  defp rules do
    Map.fetch!(Constants.bonustime_game_rules(), "hammer_smash")
  end

  defp rules_streak_factor do
    Map.fetch!(rules(), "min_power_streak_factor")
  end

  defp rules_streak_cap do
    Map.fetch!(rules(), "min_power_streak_cap")
  end
end
