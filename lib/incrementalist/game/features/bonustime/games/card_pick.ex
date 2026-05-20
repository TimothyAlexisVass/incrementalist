defmodule Incrementalist.Game.Features.BonusTime.Games.CardPick do
  @moduledoc """
  "Card Pick" daily bonus mini-game rules.

  A single-step server-authoritative card-flipping game.
  Board has 36 tiles.
  """
  alias Incrementalist.Game.Time

  # Exact mathematical weights for card tier generation (Tiers 1-7)
  # Sum of chances: 0.613 + 0.20 + 0.10 + 0.05 + 0.025 + 0.01 + 0.002 = 1.000 (100%)
  @chances [0.613, 0.20, 0.10, 0.05, 0.025, 0.01, 0.002]

  def roll_reward(streak, _bonustime_flips, _now \\ Time.now()) do
    # 1. Calculate initial flips/picks based on streak
    initial_picks = 2 + min(7, div(max(0, streak), 7))

    # 2. Generate initial 36 board cards
    # Each card starts with multiplier 1 and a rolled baseline tier (1-7)
    board_cards =
      Enum.map(0..35, fn idx ->
        tier = generate_roll(@chances) + 1
        %{card_index: idx, tier: tier, multiplier: 1}
      end)

    # 3. Process the sequential interactive bonus chain
    {total_picks, final_board} = evaluate_bonus_chain(initial_picks, board_cards, streak)

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
  defp evaluate_bonus_chain(picks, board_cards, streak) do
    # Phase 1: Bonus 1 check
    # Chance: 0.2 + 0.8 * (streak / 77), capped at streak 77
    bonus_1_chance = 0.2 + 0.8 * min(77, max(0, streak)) / 77
    r1 = :rand.uniform()

    if r1 <= bonus_1_chance do
      # Success: add +1 pick, double remaining card multipliers (from picks onwards)
      new_picks = picks + 1
      board_cards = multiply_range(board_cards, picks..35, 2)

      # Phase 2: Bonus 2 check
      # Chance: 10%
      r2 = :rand.uniform()

      if r2 <= 0.10 do
        # Success: add +1 pick, double remaining cards (from picks + 1 onwards)
        new_picks = new_picks + 1
        board_cards = multiply_range(board_cards, (picks + 1)..35, 2)

        # Phase 3: Consecutive loop
        # Chance: 5% per roll, capped when all 36 cards are claimed
        evaluate_consecutive_loop(new_picks, board_cards, picks + 2)
      else
        {new_picks, board_cards}
      end
    else
      {picks, board_cards}
    end
  end

  # Evaluate successive checks per card slot until failure or grid max (36 cards) is reached
  defp evaluate_consecutive_loop(picks, board_cards, current_index)
       when current_index < 36 and picks < 36 do
    r = :rand.uniform()

    if r <= 0.05 do
      # Success: add +1 pick. Multipliers remain at 4x (already pre-doubled).
      # Recur to the next check
      evaluate_consecutive_loop(picks + 1, board_cards, current_index + 1)
    else
      {picks, board_cards}
    end
  end

  defp evaluate_consecutive_loop(picks, board_cards, _current_index) do
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
end
