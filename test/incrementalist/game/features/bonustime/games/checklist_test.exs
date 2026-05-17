defmodule Incrementalist.Game.Features.BonusTime.Games.ChecklistTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.Checklist
  alias Incrementalist.Game.State

  setup do
    state = State.new()
    {:ok, state: state}
  end

  test "check_off/2 correctly advances resource index and wraps modulo 17", %{state: state} do
    # Initial index should be 0
    assert state.bonustime.checklist_entry_indexes["resource"] == 0

    # 1st step: index 0 -> 1, grants tier 2
    {:ok, state, tier, index} = Checklist.check_off(state, "resource")
    assert index == 0
    assert tier == 2
    assert state.bonustime.checklist_entry_indexes["resource"] == 1

    # 2nd step: index 1 -> 2, grants tier 2
    {:ok, state, tier, index} = Checklist.check_off(state, "resource")
    assert index == 1
    assert tier == 2
    assert state.bonustime.checklist_entry_indexes["resource"] == 2

    # 3rd step: index 2 -> 3, grants tier 3
    {:ok, state, tier, index} = Checklist.check_off(state, "resource")
    assert index == 2
    assert tier == 3
    assert state.bonustime.checklist_entry_indexes["resource"] == 3

    # Fast-forward to 16th step (index 15 -> 16, grants tier 4)
    state = put_in(state.bonustime.checklist_entry_indexes["resource"], 15)
    {:ok, state, tier, index} = Checklist.check_off(state, "resource")
    assert index == 15
    assert tier == 4
    assert state.bonustime.checklist_entry_indexes["resource"] == 16

    # 17th step (index 16 -> 0 (wrap!), grants tier 7)
    {:ok, state, tier, index} = Checklist.check_off(state, "resource")
    assert index == 16
    assert tier == 7
    assert state.bonustime.checklist_entry_indexes["resource"] == 0
  end

  test "check_off/2 correctly advances item index and wraps modulo 17", %{state: state} do
    # Initial index should be 0
    assert state.bonustime.checklist_entry_indexes["item"] == 0

    # 1st step: index 0 -> 1, grants tier 2
    {:ok, state, tier, index} = Checklist.check_off(state, "item")
    assert index == 0
    assert tier == 2
    assert state.bonustime.checklist_entry_indexes["item"] == 1

    # Fast-forward to 17th step (index 16 -> 0 (wrap!), grants tier 7)
    state = put_in(state.bonustime.checklist_entry_indexes["item"], 16)
    {:ok, state, tier, index} = Checklist.check_off(state, "item")
    assert index == 16
    assert tier == 7
    assert state.bonustime.checklist_entry_indexes["item"] == 0
  end
end
