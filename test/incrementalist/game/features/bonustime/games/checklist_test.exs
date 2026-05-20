defmodule Incrementalist.Game.Features.BonusTime.Games.ChecklistTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.BonusTime.Games.Checklist
  alias Incrementalist.Game.State

  @expected_tiers [1, 1, 2, 2, 3, 2, 3, 4, 2, 3, 5, 4, 6, 5, 7]

  setup do
    state = State.new()
    {:ok, state: state}
  end

  test "check_off/2 follows the shared 15-entry checklist shape and wraps cleanly", %{state: state} do
    assert Constants.bonustime_checklist_grid_columns() == 5
    assert Constants.bonustime_checklist_grid_rows() == 3
    assert Constants.bonustime_checklist_entries() == @expected_tiers

    for checklist_key <- ["resource", "item"] do
      final_state =
        Enum.reduce(Enum.with_index(@expected_tiers), state, fn {expected_tier, expected_index}, current_state ->
          {:ok, next_state, tier, index} = Checklist.check_off(current_state, checklist_key)

          assert index == expected_index
          assert tier == expected_tier
          assert next_state.bonustime.checklist_entry_indexes[checklist_key] ==
                   rem(expected_index + 1, length(@expected_tiers))

          next_state
        end)

      {:ok, wrapped_state, tier, index} = Checklist.check_off(final_state, checklist_key)
      assert index == 0
      assert tier == hd(@expected_tiers)
      assert wrapped_state.bonustime.checklist_entry_indexes[checklist_key] == 1
    end
  end
end
