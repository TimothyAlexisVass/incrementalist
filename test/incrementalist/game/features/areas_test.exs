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

  test "visible_area_defs/1 keeps furnace area copy from shared area requirements" do
    state = %{State.new() | area: "furnace", furnace_level: 4}

    furnace =
      state
      |> Areas.visible_area_defs()
      |> Enum.find(&(&1.key == "furnace"))

    assert furnace
    assert furnace.name == "Campfire"

    assert furnace.description ==
             "A place where travelers gather to rest, share stories, and prepare for the journey ahead."
  end

  test "upgrade_furnace/1 increments furnace level while in furnace area" do
    state = %{State.new() | area: "furnace", furnace_level: 2}

    assert {:ok, next_state} = Areas.upgrade_furnace(state)
    assert next_state.furnace_level == 3
  end

  test "upgrade_furnace/1 rejects upgrades outside furnace area" do
    state = %{State.new() | area: "sage", furnace_level: 2}

    assert {:error, :furnace_only} = Areas.upgrade_furnace(state)
  end

  test "upgrade_furnace/1 rejects upgrade at max furnace level" do
    state = %{State.new() | area: "furnace", furnace_level: Constants.furnace_max_level()}

    assert {:error, :furnace_max_level_reached} = Areas.upgrade_furnace(state)
  end
end
