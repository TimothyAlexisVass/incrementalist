defmodule Incrementalist.Game.Features.AreasTest do
  use Incrementalist.DataCase
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Features.Areas

  test "select_area/2 allows selecting an unlocked area" do
    # level 1
    state = State.new()
    # Sage is unlock_level 1
    assert {:ok, next_state} = Areas.select_area(state, "sage")
    assert next_state.area == "sage"
  end

  test "select_area/2 rejects a locked area" do
    state = State.new()
    assert {:error, :area_locked} = Areas.select_area(state, "cloverfield")
  end

  test "select_area/2 rejects unknown area" do
    state = State.new()
    assert {:error, :unknown_area} = Areas.select_area(state, "non_existent")
  end

  test "select_area/2 allows selecting cloverfield at its unlock level" do
    cloverfield_unlock_level =
      Constants.area_defs()
      |> Enum.find(&(&1.key == "cloverfield"))
      |> Map.fetch!(:unlock_level)

    state = %{State.new() | level: cloverfield_unlock_level}
    assert {:ok, next_state} = Areas.select_area(state, "cloverfield")
    assert next_state.area == "cloverfield"
  end
end
