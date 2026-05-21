defmodule Incrementalist.Game.Features.BonusTime.Games.ScratchCard do
  @moduledoc """
  Scratch Card daily bonus mini-game rules.

  The server pre-rolls the total scratch budget and an ordered reveal schedule.
  Client scratch coordinates remain cosmetic; only cumulative scratched pixels
  advance the schedule.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Time

  def roll_reward(streak, _bonustime_flips, _now \\ Time.now()) do
    rules = rules()
    board_pixels = board_pixels(rules)
    pixel_budget = roll_pixel_budget(board_pixels, streak, Map.fetch!(rules, "pixel_budget"))
    budget_ratio = pixel_budget / board_pixels
    reward_count = roll_reward_count(budget_ratio, pixel_budget, rules)
    chances = Map.fetch!(rules, "chances")
    min_threshold_gap_pixels = min_threshold_gap_pixels(rules)

    reveal_schedule =
      roll_reveal_schedule(pixel_budget, reward_count, min_threshold_gap_pixels, chances)

    {pixel_budget, reveal_schedule}
  end

  defp roll_pixel_budget(board_pixels, streak, pixel_budget_rules) do
    rand_min = to_number(Map.fetch!(pixel_budget_rules, "rand_min"))
    rand_max = to_number(Map.fetch!(pixel_budget_rules, "rand_max"))
    streak_scaling = Map.fetch!(pixel_budget_rules, "streak_scaling")
    per_day_bonus = to_number(Map.fetch!(streak_scaling, "per_day"))
    max_streak_bonus = to_number(Map.fetch!(streak_scaling, "max_bonus"))
    streak_bonus = min(max_streak_bonus, max(0, streak) * per_day_bonus)
    random_ratio = random_between(rand_min, rand_max)
    budget_ratio = random_ratio + streak_bonus
    max(1, trunc(:math.floor(board_pixels * budget_ratio)))
  end

  defp roll_reward_count(budget_ratio, pixel_budget, rules) do
    reward_count_rules = Map.fetch!(rules, "reward_count")
    budget_min = to_number(Map.fetch!(reward_count_rules, "budget_min"))
    budget_max = to_number(Map.fetch!(reward_count_rules, "budget_max"))
    min_scale_base = to_number(Map.fetch!(reward_count_rules, "min_scale_base"))
    max_scale_base = to_number(Map.fetch!(reward_count_rules, "max_scale_base"))
    bias_at_min_budget = to_number(Map.fetch!(reward_count_rules, "bias_at_min_budget"))
    bias_at_max_budget = to_number(Map.fetch!(reward_count_rules, "bias_at_max_budget"))

    budget_t =
      if budget_max > budget_min do
        clamp01((budget_ratio - budget_min) / (budget_max - budget_min))
      else
        0.0
      end

    scale =
      if budget_max > 0 do
        :math.sqrt(max(0.0, budget_ratio / budget_max))
      else
        0.0
      end

    min_rewards = max(1, trunc(:math.floor(min_scale_base * scale)))
    max_rewards_from_scale = trunc(:math.floor(max_scale_base * scale))
    max_rewards = max(min_rewards, min(trunc(max_scale_base), max_rewards_from_scale))
    bias = bias_at_min_budget + (bias_at_max_budget - bias_at_min_budget) * budget_t
    random_value = :rand.uniform()
    shaped_roll = bias * :math.sqrt(random_value) + (1.0 - bias) * random_value * random_value
    span = max_rewards - min_rewards + 1
    offset = min(span - 1, max(0, trunc(:math.floor(shaped_roll * span))))
    rolled_count = min_rewards + offset

    max_roll_count =
      min(
        Map.fetch!(rules, "lifts_left"),
        Map.fetch!(rules, "hidden_item_count")
      )

    max_by_budget =
      case min_threshold_gap_pixels(rules) do
        gap when gap > 0 -> div(max(0, pixel_budget - 1), gap) + 1
        _ -> max_roll_count
      end

    rolled_count
    |> max(1)
    |> min(max_roll_count)
    |> min(max_by_budget)
  end

  defp roll_reveal_schedule(pixel_budget, reward_count, min_gap_pixels, chances) do
    {_, schedule_rev} =
      Enum.reduce(0..(reward_count - 1), {1, []}, fn idx, {min_threshold, acc} ->
        remaining_after_current = reward_count - idx - 1

        max_threshold =
          max(min_threshold, pixel_budget - min_gap_pixels * remaining_after_current)

        threshold = random_int(min_threshold, max_threshold)
        tier = generate_roll(chances) + 1
        next_min_threshold = threshold + min_gap_pixels
        {next_min_threshold, [%{pixels: threshold, tier: tier} | acc]}
      end)

    Enum.reverse(schedule_rev)
  end

  defp generate_roll(chances) do
    roll = :rand.uniform() * Enum.sum(chances)

    {_, index} =
      Enum.reduce_while(chances, {0.0, 0}, fn chance, {acc, idx} ->
        next_acc = acc + chance

        if roll <= next_acc do
          {:halt, {next_acc, idx}}
        else
          {:cont, {next_acc, idx + 1}}
        end
      end)

    index
  end

  defp board_pixels(rules) do
    board_size = Map.fetch!(rules, "board_size")
    width = Map.fetch!(board_size, "width")
    height = Map.fetch!(board_size, "height")
    width * height
  end

  defp min_threshold_gap_pixels(rules) do
    rules
    |> Map.fetch!("reveal_schedule")
    |> Map.fetch!("min_threshold_gap_pixels")
  end

  defp random_between(min_value, max_value) when min_value == max_value, do: min_value

  defp random_between(min_value, max_value),
    do: min_value + :rand.uniform() * (max_value - min_value)

  defp random_int(min_value, max_value) when max_value <= min_value, do: min_value

  defp random_int(min_value, max_value) do
    min_value + :rand.uniform(max_value - min_value + 1) - 1
  end

  defp clamp01(value) when is_number(value), do: min(1.0, max(0.0, value))

  defp to_number(value) when is_float(value), do: value
  defp to_number(value) when is_integer(value), do: value * 1.0

  defp to_number(value) when is_binary(value) do
    case Float.parse(value) do
      {parsed, _} -> parsed
      :error -> 0.0
    end
  end

  defp to_number(_), do: 0.0

  defp rules do
    Map.fetch!(Constants.bonustime_game_rules(), "scratch_card")
  end
end
