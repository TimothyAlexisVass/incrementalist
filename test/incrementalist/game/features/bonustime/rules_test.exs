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

  test "legacy bonustime_game_override no longer controls active game selection" do
    now = Constants.bonustime_rotation_anchor_at()
    Application.put_env(:incrementalist, :bonustime_game_override, "prize_wheel")

    assert Rules.get_active_game_id(now) == "chest_draw"
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
end
