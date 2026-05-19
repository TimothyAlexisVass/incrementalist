defmodule Incrementalist.Game.Features.BonusTime.JackpotRules do
  @moduledoc """
  Rules for the progressive Jackpot Meter system.
  """
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Constants

  @doc """
  Executes a single Jackpot Meter play.
  Increments progress (or handles guaranteed/chance jackpot rolls),
  updates state, and returns the result.
  """
  def play(%State{} = state) do
    bonustime = state.bonustime
    current_progress = bonustime.jackpot_progress || 0

    rules = Constants.bonustime_game_rules()["jackpot_meter"] || %{}
    base_chance = rules["base_chance"] || 0.005
    miss_increment = rules["miss_increment"] || 0.005

    # Streak bonus: 0.5% + min(floor(streak / 100), 1)%
    streak = bonustime.streak || 0
    streak_bonus_rules = rules["streak_bonus"] || %{"divisor" => 100, "cap" => 0.01}
    divisor = streak_bonus_rules["divisor"] || 100
    cap = streak_bonus_rules["cap"] || 0.01

    streak_bonus = min(div(streak, divisor) * 0.01, cap)
    base_chance_total = base_chance + streak_bonus

    # 14th play is guaranteed jackpot (since current_progress starts at 13)
    is_guaranteed = current_progress >= 13

    # Calculate jackpot chance
    jackpot_chance =
      if is_guaranteed do
        1.0
      else
        min(1.0, base_chance_total + current_progress * miss_increment)
      end

    roll = :rand.uniform()

    if roll <= jackpot_chance do
      # JACKPOT HIT!
      # Grant tier_7, reset jackpot progress to 0
      new_bonustime = %{bonustime | jackpot_progress: 0}
      {:ok, %{state | bonustime: new_bonustime}, 7, 14}
    else
      # JACKPOT MISS (Consolation)
      new_progress = current_progress + 1
      new_bonustime = %{bonustime | jackpot_progress: new_progress}

      # Roll consolation prize (tiers 1 to 6)
      consolation_chances = rules["consolation_chances"] || [0.55, 0.25, 0.10, 0.06, 0.03, 0.01]
      tier = roll_consolation_tier(consolation_chances)

      {:ok, %{state | bonustime: new_bonustime}, tier, new_progress}
    end
  end

  defp roll_consolation_tier(chances) do
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

    # index is 0..5, map to tier 1..6
    index + 1
  end
end
