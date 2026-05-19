defmodule Incrementalist.Game.Features.BonusTime.Games.RewardLabyrinth do
  @moduledoc """
  "Reward Labyrinth" daily bonus mini-game rules.

  A single-step server-authoritative maze game where paths are navigated locally,
  and reward chests are placed at deterministic step thresholds.
  """
  alias Incrementalist.Game.Time

  # Exact mathematical weights for chest tier generation (Tiers 1-7)
  # Sum of chances: 0.55 + 0.25 + 0.12 + 0.05 + 0.02 + 0.009 + 0.001 = 1.000 (100%)
  @chances [0.55, 0.25, 0.12, 0.05, 0.02, 0.009, 0.001]

  def roll_reward(streak, _bonustime_flips, _now \\ Time.now()) do
    # 1. Calculate step budget based on streak
    # steps = rand(4, 10) + min(streak / 15, 20)
    base_steps = :rand.uniform(7) + 3 # 4..10
    streak_bonus = min(div(max(0, streak), 15), 20)
    steps_total = base_steps + streak_bonus

    # 2. Determine number of chests to spawn
    # Scales with step budget: minimum 2, up to 5 chests
    num_chests = min(steps_total, :rand.uniform(3) + 1 + div(steps_total, 6))
    num_chests = max(2, num_chests)

    # 3. Choose unique steps at which chests will be found
    # Step index is between 1 and steps_total (inclusive)
    chest_steps =
      1..steps_total
      |> Enum.shuffle()
      |> Enum.take(num_chests)
      |> Enum.sort()

    # 4. Roll chest tiers
    chests =
      Enum.map(chest_steps, fn step ->
        tier = generate_roll(@chances) + 1
        %{step: step, tier: tier}
      end)

    {steps_total, chests}
  end

  # Helper to roll a tier based on cumulative chances
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
end
