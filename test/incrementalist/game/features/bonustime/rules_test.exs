defmodule Incrementalist.Game.Features.BonusTime.RulesTest do
  use ExUnit.Case, async: false

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.BonusTime.Rules
  alias Incrementalist.Game.Time

  setup do
    Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
    Application.delete_env(:incrementalist, :bonustime_game_override)

    on_exit(fn ->
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
      Application.delete_env(:incrementalist, :bonustime_game_override)
    end)

    :ok
  end

  test "rotation anchor override controls active game selection" do
    now = Constants.bonustime_rotation_anchor_at()
    overridden_anchor = DateTime.add(now, -Constants.bonustime_slot_ms(), :millisecond)

    Application.put_env(
      :incrementalist,
      :bonustime_rotation_anchor_override,
      Time.iso8601(overridden_anchor)
    )

    assert Rules.get_active_game_id(now) == "prize_wheel"
  end

  test "rotation helpers are derived from the shared games map" do
    games = Constants.bonustime_games()
    rotation = Constants.bonustime_rotation()

    assert Constants.bonustime_rotation_slot_count() == map_size(games)

    Enum.each(games, fn {game_id, game} ->
      assert rotation[Integer.to_string(game["slot"])] == game_id
    end)
  end

  test "its_bonus_time correctly generates 128 tile board and flips based on streak" do
    alias Incrementalist.Game.Features.BonusTime.Games.ItsBonusTime

    # Streak 0: base picks
    {flips, board} = ItsBonusTime.roll_reward(0, 0)
    assert length(board) == 128
    assert flips >= 1
    assert Enum.all?(board, fn tier -> tier >= 1 and tier <= 7 end)
    assert Enum.count(board, fn tier -> tier == 7 end) == 1

    # Streak 150
    {flips_with_streak, _board} = ItsBonusTime.roll_reward(150, 0)
    assert flips_with_streak > flips
  end
end
