defmodule Incrementalist.Game.Features.BonusTime.Games.PlinkoDrop do
  @moduledoc """
  Plinko Drop mini-game rules.

  The server owns tier outcomes and bounce-roll generation.
  The client only animates the returned authoritative rolls.
  """

  alias Incrementalist.Game.Constants

  @bounce_count 13
  @first_roll true
  @min_true_for_tier 6
  @default_lane_count 7
  @min_tier 1
  @max_tier 7
  @bin_delta 0.5

  def roll_reward(streak) when is_integer(streak) do
    rules = Constants.bonustime_game_rules()["plinko_drop"] || %{}
    chances = rules["chances"] || []
    drop_count = compute_drop_count(streak, rules["drop_count"] || %{})

    drops =
      Enum.map(1..drop_count, fn _ ->
        generate_drop(chances)
      end)

    {best_drop, best_index} =
      drops
      |> Enum.with_index()
      |> Enum.max_by(fn {drop, _idx} -> drop["tier"] end)

    plinko = %{
      "rows" => @bounce_count,
      "lanes" => @default_lane_count,
      "best_drop_index" => best_index,
      "drops" => drops
    }

    {best_drop["tier"], best_drop["rolls"], plinko}
  end

  defp generate_drop(chances) do
    target_tier = roll_tier(chances)
    rolls = build_rolls_for_tier(target_tier)
    true_count = Enum.count(rolls, & &1)
    tier = clamp_tier(true_count - @min_true_for_tier)

    %{
      "tier" => tier,
      "landing_lane" => tier - 1,
      "true_count" => true_count,
      "rolls" => rolls
    }
  end

  defp compute_drop_count(streak, drop_count_rules) do
    base = positive_integer(drop_count_rules["base"], 1)
    max_count = positive_integer(drop_count_rules["max"], 3)
    divisor = positive_integer(drop_count_rules["streak_divisor"], 45)

    bonus =
      if divisor > 0 do
        div(max(streak, 0), divisor)
      else
        0
      end

    min(max_count, base + bonus)
  end

  defp build_rolls_for_tier(target_tier) do
    required_true_count = target_tier + @min_true_for_tier
    remaining_true_count = required_true_count - 1
    remaining_roll_count = @bounce_count - 1
    first_position = apply_roll_to_position(0.0, @first_roll)

    case build_remaining_rolls(remaining_roll_count, remaining_true_count, first_position) do
      {:ok, remaining_rolls} -> [@first_roll | remaining_rolls]
      :error -> [@first_roll | List.duplicate(true, remaining_roll_count)]
    end
  end

  defp build_remaining_rolls(0, 0, _position), do: {:ok, []}
  defp build_remaining_rolls(0, _trues_left, _position), do: :error

  defp build_remaining_rolls(steps_left, trues_left, _position)
       when trues_left < 0 or trues_left > steps_left or steps_left < 0 do
    :error
  end

  defp build_remaining_rolls(steps_left, trues_left, position) do
    candidate_rolls = shuffled_candidate_rolls(trues_left, steps_left, position)
    try_roll_candidates(candidate_rolls, steps_left, trues_left, position)
  end

  defp try_roll_candidates([], _steps_left, _trues_left, _position), do: :error

  defp try_roll_candidates([roll | rest], steps_left, trues_left, position) do
    next_trues_left = if roll, do: trues_left - 1, else: trues_left
    next_position = apply_roll_to_position(position, roll)

    case build_remaining_rolls(steps_left - 1, next_trues_left, next_position) do
      {:ok, tail} -> {:ok, [roll | tail]}
      :error -> try_roll_candidates(rest, steps_left, trues_left, position)
    end
  end

  defp shuffled_candidate_rolls(trues_left, steps_left, position) do
    can_emit_true = trues_left > 0
    can_emit_false = trues_left < steps_left and position > 0.0

    case {can_emit_true, can_emit_false} do
      {true, true} ->
        if :rand.uniform(2) == 1, do: [true, false], else: [false, true]

      {true, false} ->
        [true]

      {false, true} ->
        [false]

      {false, false} ->
        []
    end
  end

  defp apply_roll_to_position(position, roll) do
    delta = if roll, do: @bin_delta, else: -@bin_delta
    next_position = position + delta
    max(0.0, min(@default_lane_count * 1.0, next_position))
  end

  defp roll_tier(chances) when is_list(chances) and chances != [] do
    r = :rand.uniform()

    {tier_index, _acc} =
      Enum.reduce_while(Enum.with_index(chances), {0, 0.0}, fn {chance, idx}, {_found_idx, acc} ->
        next_acc = acc + to_number(chance, 0.0)

        if r <= next_acc do
          {:halt, {idx, next_acc}}
        else
          {:cont, {idx, next_acc}}
        end
      end)

    clamp_tier(tier_index + 1)
  end

  defp roll_tier(_chances), do: 1

  defp clamp_tier(tier), do: max(@min_tier, min(@max_tier, tier))

  defp positive_integer(value, fallback) do
    value
    |> to_integer(fallback)
    |> max(1)
  end

  defp to_integer(value, _fallback) when is_integer(value), do: value

  defp to_integer(value, _fallback) when is_float(value), do: trunc(value)

  defp to_integer(value, fallback) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, _} -> parsed
      :error -> fallback
    end
  end

  defp to_integer(_value, fallback), do: fallback

  defp to_number(value, _fallback) when is_float(value), do: value
  defp to_number(value, _fallback) when is_integer(value), do: value * 1.0

  defp to_number(value, fallback) when is_binary(value) do
    case Float.parse(value) do
      {parsed, _} -> parsed
      :error -> fallback
    end
  end

  defp to_number(_value, fallback), do: fallback
end
