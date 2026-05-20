defmodule Incrementalist.Game.Features.BonusTime.Games.CardPick do
  @moduledoc """
  "Card Pick" daily bonus mini-game rules.

  A single-step server-authoritative card-flipping game.
  Board has 36 tiles.
  """
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Time

  def board_size do
    Map.fetch!(rules(), "board_size")
  end

  def initial_picks(streak) do
    initial_picks_rules = Map.fetch!(rules(), "initial_picks")
    base = Map.fetch!(initial_picks_rules, "base")
    streak_divisor = Map.fetch!(initial_picks_rules, "streak_divisor")
    streak_cap = Map.fetch!(initial_picks_rules, "streak_cap")

    base + min(streak_cap, div(max(0, streak), streak_divisor))
  end

  def roll_reward(streak, _bonustime_flips, _now \\ Time.now()) do
    # 1. Calculate initial flips/picks based on streak
    initial_picks = initial_picks(streak)
    board_size = board_size()

    # 2. Generate initial 36 board cards
    # Each card starts with multiplier 1 and a rolled baseline tier (1-7)
    board_cards =
      Enum.map(0..(board_size - 1), fn idx ->
        tier = generate_roll(Map.fetch!(rules(), "chances")) + 1
        %{card_index: idx, tier: tier, multiplier: 1}
      end)

    # 3. Process the sequential interactive bonus chain
    {total_picks, final_board} = evaluate_bonus_chain(initial_picks, board_cards, streak, board_size)

    # Return total flips and the full card array
    {total_picks, final_board}
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

  # Evaluate bonus chain checking sequentially
  defp evaluate_bonus_chain(picks, board_cards, streak, board_size) do
    # Phase 1: Bonus 1 check
    # Chance: 0.2 + 0.8 * (streak / 77), capped at streak 77
    bonus_1_rules = Map.fetch!(Map.fetch!(rules(), "bonus_chain"), "first")
    bonus_1_chance =
      Map.fetch!(bonus_1_rules, "base") +
        Map.fetch!(bonus_1_rules, "streak_scale") * min(Map.fetch!(bonus_1_rules, "streak_cap"), max(0, streak)) / Map.fetch!(bonus_1_rules, "streak_cap")
    r1 = :rand.uniform()

    if r1 <= bonus_1_chance do
      # Success: add +1 pick, double remaining card multipliers (from picks onwards)
      new_picks = picks + 1
      board_cards = multiply_range(board_cards, picks..(board_size - 1), 2)

      # Phase 2: Bonus 2 check
      # Chance: 10%
      r2 = :rand.uniform()

      if r2 <= Map.fetch!(Map.fetch!(rules(), "bonus_chain"), "second") do
        # Success: add +1 pick, double remaining cards (from picks + 1 onwards)
        new_picks = new_picks + 1
        board_cards = multiply_range(board_cards, (picks + 1)..(board_size - 1), 2)

        # Phase 3: Consecutive loop
        # Chance: 5% per roll, capped when all 36 cards are claimed
        evaluate_consecutive_loop(new_picks, board_cards, picks + 2, board_size)
      else
        {new_picks, board_cards}
      end
    else
      {picks, board_cards}
    end
  end

  # Evaluate successive checks per card slot until failure or grid max (36 cards) is reached
  defp evaluate_consecutive_loop(picks, board_cards, current_index, board_size)
       when current_index < board_size and picks < board_size do
    r = :rand.uniform()

    if r <= Map.fetch!(Map.fetch!(rules(), "bonus_chain"), "loop") do
      # Success: add +1 pick. Multipliers remain at 4x (already pre-doubled).
      # Recur to the next check
      evaluate_consecutive_loop(picks + 1, board_cards, current_index + 1, board_size)
    else
      {picks, board_cards}
    end
  end

  defp evaluate_consecutive_loop(picks, board_cards, _current_index, _board_size) do
    {picks, board_cards}
  end

  # Multiplies multipliers of cards in board_cards within a specific range of sequence indices
  defp multiply_range(board_cards, range, factor) do
    Enum.map(board_cards, fn card ->
      if card.card_index in range do
        %{card | multiplier: card.multiplier * factor}
      else
        card
      end
    end)
  end

  defp rules do
    Map.fetch!(Constants.bonustime_game_rules(), "card_pick")
  end
end
