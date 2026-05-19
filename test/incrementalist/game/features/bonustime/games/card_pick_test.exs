defmodule Incrementalist.Game.Features.BonusTime.Games.CardPickTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.CardPick
  alias Incrementalist.Game.Time

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

  test "roll_reward/3 scales initial picks based on streak" do
    now = Time.now()

    # streak 0 => 2 picks (base)
    # streak 7 => 3 picks
    # streak 49 => 9 picks
    {flips_0, _} = CardPick.roll_reward(0, 0, now)
    assert flips_0 >= 2

    {flips_7, _} = CardPick.roll_reward(7, 0, now)
    assert flips_7 >= 3

    {flips_49, _} = CardPick.roll_reward(49, 0, now)
    assert flips_49 >= 9
  end
end
