defmodule Incrementalist.Game.Features.BonusTime.Games.ItsBonusTimeTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.ItsBonusTime
  alias Incrementalist.Game.Time

  test "roll_reward/3 generates a correct 128-tile board with exactly one tier_7" do
    now = Time.now()
    {flips, board_tiers} = ItsBonusTime.roll_reward(0, 0, now)

    # Streak 0 + 0 flips = 1 flip base.
    assert flips == 1
    assert length(board_tiers) == 128

    # Validate exactly one tier_7 tile
    tier_7_count = Enum.count(board_tiers, &(&1 == 7))
    assert tier_7_count == 1
  end

  test "roll_reward/3 scales flips dynamically based on streak and previous flips" do
    now = Time.now()

    # 3 bonustime_flips + streak 150 (5 flips) = 1 base + 3 + 5 = 9 flips
    {flips, _} = ItsBonusTime.roll_reward(150, 3, now)
    assert flips == 9
  end
end
