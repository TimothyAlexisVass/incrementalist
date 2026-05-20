defmodule Incrementalist.Game.Features.BonusTime.Games.CardPickTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.CardPick
  alias Incrementalist.Game.Time

  test "shared card pick rules preserve the board size and streak scaling" do
    assert CardPick.board_size() == 36
    assert CardPick.initial_picks(0) == 2
    assert CardPick.initial_picks(7) == 3
    assert CardPick.initial_picks(49) == 9
  end

  test "roll_reward/3 generates a correct 36-card board" do
    now = Time.now()
    {flips, board} = CardPick.roll_reward(0, 0, now)

    assert flips >= 2
    assert length(board) == 36

    for card <- board do
      assert card.card_index in 0..35
      assert card.tier in 1..7
      assert card.multiplier in [1, 2, 4]
    end
  end
end
