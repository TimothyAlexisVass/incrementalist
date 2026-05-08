defmodule Incrementalist.Game.Features.AreasTest do
  use Incrementalist.DataCase
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Features.Areas

  test "select_area/2 allows selecting an unlocked area" do
    state = State.new() # level 1
    # Sage is unlock_level 1
    assert {:ok, next_state} = Areas.select_area(state, "sage")
    assert next_state.area == "sage"
  end

  test "select_area/2 rejects a locked area" do
    state = State.new() # level 1
    # Cloverfield is unlock_level 10
    assert {:error, :area_locked} = Areas.select_area(state, "cloverfield")
  end

  test "select_area/2 rejects unknown area" do
    state = State.new()
    assert {:error, :unknown_area} = Areas.select_area(state, "non_existent")
  end

  test "select_area/2 allows selecting cloverfield at level 10" do
    state = %{State.new() | level: 10}
    assert {:ok, next_state} = Areas.select_area(state, "cloverfield")
    assert next_state.area == "cloverfield"
  end
end
