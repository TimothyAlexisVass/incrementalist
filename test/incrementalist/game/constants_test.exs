defmodule Incrementalist.Game.ConstantsTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.Progress.Sisu.Levels

  test "shared area and tip requirements are loaded from the manifest" do
    assert [
             %{key: "sage", unlock_level: 1},
             %{key: "orchard", unlock_level: 1},
             %{key: "furnace", unlock_level: 1},
             %{key: "cloverfield", unlock_level: 6},
             %{key: "market", unlock_level: 15}
           ] = Constants.area_defs()

    assert [1, 2, 4, 6, 15] = Constants.sage_tip_levels()
  end

  test "shop_item_defs/0 loads the shared shop requirements manifest" do
    assert [
             %{
               id: "idle_mode",
               name: "Idle Mode",
               description: "Allows you to claim rewards automatically!",
               cost: %BigNum{m: 5.0, e: 2},
               currency: :coins,
               required_level: 2
             },
             %{
               id: "sisu_generator",
               name: "Sisu Generator",
               description: "Multiply your progress bar fill speed!",
               cost: %BigNum{m: 2.0, e: 3},
               currency: :coins,
               required_level: 4
             },
             %{
               id: "bonus_time",
               name: "BONUSTIME",
               description: "Play Bonustime games and win daily prizes!",
               cost: %BigNum{m: 1.0, e: 3},
               currency: :shards,
               required_level: 15
             }
           ] = Constants.shop_item_defs()
  end

  test "furnace levels load from shared furnace requirements" do
    assert Constants.furnace_min_level() == 1
    assert Constants.furnace_max_level() == 6
  end

  test "sisu levels load the shared upgrade table" do
    assert Levels.base_max() == 2.0
    assert Levels.per_level() == 0.5
    assert Levels.max_upgrade_level() == 1769
    assert %BigNum{m: 2.5, e: 3} = Levels.upgrade_cost(1)
    assert %BigNum{m: 1.0, e: 7} = Levels.upgrade_cost(12)
    assert %BigNum{m: 9.5, e: 7} = Levels.upgrade_cost(18)
    assert %BigNum{m: 6.5, e: 299} = Levels.upgrade_cost(Levels.max_upgrade_level())
  end
end
