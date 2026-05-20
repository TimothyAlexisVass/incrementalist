defmodule Incrementalist.Game.Features.BonusTime.Games.RewardLabyrinth do
  @moduledoc """
  "Reward Labyrinth" daily bonus mini-game rules.

  A single-step server-authoritative maze game where paths are navigated locally,
  and reward chests are placed at deterministic step thresholds.
  """
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Time

  def roll_reward(streak, _bonustime_flips, _now \\ Time.now()) do
    rules = Map.fetch!(Constants.bonustime_game_rules(), "reward_labyrinth")
    chances = Map.fetch!(rules, "chances")
    step_budget = Map.fetch!(rules, "step_budget")
    chest_count = Map.fetch!(rules, "chest_count")

    steps_total = calculate_step_budget(streak, step_budget)
    num_chests = calculate_chest_count(steps_total, chest_count)

    chest_steps =
      1..steps_total
      |> Enum.shuffle()
      |> Enum.take(num_chests)
      |> Enum.sort()

    chests =
      Enum.map(chest_steps, fn step ->
        tier = generate_roll(chances) + 1
        %{step: step, tier: tier}
      end)

    {steps_total, chests}
  end

  defp calculate_step_budget(streak, step_budget) do
    base_steps = random_inclusive(Map.fetch!(step_budget, "base_min"), Map.fetch!(step_budget, "base_max"))
    streak_scaling = Map.fetch!(step_budget, "streak_scaling")
    streak_divisor = Map.fetch!(streak_scaling, "interval")
    streak_cap = Map.fetch!(streak_scaling, "max_bonus")

    base_steps + min(div(max(0, streak), streak_divisor), streak_cap)
  end

  defp calculate_chest_count(steps_total, chest_count) do
    base_chests = random_inclusive(Map.fetch!(chest_count, "base_min"), Map.fetch!(chest_count, "base_max"))
    step_divisor = Map.fetch!(chest_count, "step_divisor")

    Kernel.min(base_chests + div(steps_total, step_divisor), steps_total)
  end

  defp generate_roll(chances) do
    r = :rand.uniform()

    {_, index} =
      Enum.reduce_while(chances, {0.0, 0}, fn chance, {acc, idx} ->
        new_acc = acc + chance

        if r <= new_acc do
          {:halt, {new_acc, idx}}
        else
          {:cont, {new_acc, idx + 1}}
        end
      end)

    index
  end

  defp random_inclusive(min_value, max_value) do
    lower = min(min_value, max_value)
    upper = max(min_value, max_value)

    :rand.uniform(upper - lower + 1) + lower - 1
  end
end
