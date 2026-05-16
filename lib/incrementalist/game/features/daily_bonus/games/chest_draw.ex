defmodule Incrementalist.Game.Features.DailyBonus.Games.ChestDraw do
  @moduledoc """
  Chest Draw mini-game rules.
  """
  alias Incrementalist.Game.Constants

  def roll_reward(streak) do
    rules = Constants.daily_bonus_game_rules()["chest_draw"]
    chances = rules["chances"]
    
    # Calculate number of rolls based on streak
    # streak_scaling: { "interval": 60, "max_bonus": 2 }
    scaling = rules["streak_scaling"]
    bonus_rolls = min(scaling["max_bonus"], div(streak, scaling["interval"]))
    roll_count = 1 + bonus_rolls

    # Generate rolls
    rolls = Enum.map(1..roll_count, fn _ -> generate_roll(chances) end)
    
    # Keep the best outcome (highest tier index)
    best_tier_index = Enum.max(rolls)
    
    # Return 1-indexed tier (tier_1 to tier_7)
    {best_tier_index + 1, rolls |> Enum.map(&(&1 + 1))}
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
end
