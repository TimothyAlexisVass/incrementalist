defmodule Incrementalist.Game.Features.BonusTime.Games.LadderClimb do
  @moduledoc """
  Ladder Climb daily bonus mini-game rules.

  The server rolls the full ascent path in one shot and the client only replays
  the stored result. Rungs above 7 remain visually available, but the reward
  tier caps at tier 7.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Time

  def roll_reward(streak, _bonustime_flips, _now \\ Time.now()) do
    rules = Map.fetch!(Constants.bonustime_game_rules(), "ladder_climb")
    visible_rungs = Map.fetch!(rules, "visible_rungs")
    reward_cap_rung = Map.fetch!(rules, "reward_cap_rung")
    chances = Map.fetch!(rules, "chances")
    streak_bonus = calculate_streak_bonus(streak, Map.fetch!(rules, "streak_bonus"))

    {highest_rung, path} = roll_path(visible_rungs, chances, streak_bonus)

    {min(highest_rung, reward_cap_rung), path}
  end

  defp roll_path(visible_rungs, _chances, _streak_bonus) when visible_rungs < 2 do
    {1, []}
  end

  defp roll_path(visible_rungs, chances, streak_bonus) do
    Enum.reduce_while(2..visible_rungs, {1, []}, fn target_rung, {current_rung, acc} ->
      base_chance = chance_for_rung(chances, target_rung)
      total_chance = clamp01(base_chance + streak_bonus)
      success = :rand.uniform() <= total_chance
      reached_rung = if(success, do: target_rung, else: current_rung)

      step = %{
        "from_rung" => current_rung,
        "target_rung" => target_rung,
        "success" => success,
        "chance" => base_chance,
        "reached_rung" => reached_rung
      }

      next_acc = acc ++ [step]

      if success do
        {:cont, {target_rung, next_acc}}
      else
        {:halt, {current_rung, next_acc}}
      end
    end)
  end

  defp chance_for_rung(chances, target_rung) do
    chances
    |> Enum.at(target_rung - 1, List.last(chances) || 0.01)
    |> to_number(0.01)
  end

  defp calculate_streak_bonus(streak, %{"divisor" => divisor, "max_bonus" => max_bonus}) do
    divisor = to_number(divisor, 60.0)
    max_bonus = to_number(max_bonus, 0.01)

    if divisor <= 0 do
      0.0
    else
      min(max_bonus, max(0, streak) / divisor * max_bonus)
    end
  end

  defp calculate_streak_bonus(_streak, _rules), do: 0.0

  defp clamp01(value) when is_number(value) do
    value |> to_number(0.0) |> max(0.0) |> min(1.0)
  end

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
