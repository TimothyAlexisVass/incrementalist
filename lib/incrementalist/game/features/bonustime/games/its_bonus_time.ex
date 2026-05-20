defmodule Incrementalist.Game.Features.BonusTime.Games.ItsBonusTime do
  @moduledoc """
  "It's Bonus Time!" daily bonus mini-game rules.

  A single-step server-authoritative card-flipping game.
  Board has 128 tiles. Exactly one is tier 7, the rest are rolled.
  The server precalculates the full board, applies rewards for the allowed flips,
  and returns the full board layout.
  """
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Time

  def roll_reward(streak, bonustime_flips, _now \\ Time.now()) do
    rules = Constants.bonustime_game_rules()["bonus_time"]
    chances = rules["chances"]

    # Calculate allowed flips count
    scaling = rules["flip_count"]
    bonus_flips = min(scaling["streak_max"], div(streak, scaling["streak_divisor"]))
    flips = 1 + bonustime_flips + bonus_flips
    # Ensure at least 1 flip
    flips = max(1, flips)

    # Generate 128 tiles
    # Place exactly one tier_7 tile first
    # 0 to 127
    u_idx = :rand.uniform(128) - 1

    board_tiers =
      Enum.map(0..127, fn idx ->
        if idx == u_idx do
          7
        else
          # Roll tier 1-6
          generate_roll(chances) + 1
        end
      end)

    {flips, board_tiers}
  end

  defp generate_roll(chances) do
    r = :rand.uniform() * Enum.sum(chances)

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
