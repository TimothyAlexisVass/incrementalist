defmodule Incrementalist.Game.Features.Progress.ChargeCrystalsTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.Progress.ChargeCrystals
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Constants

  describe "default/0" do
    test "returns empty ChargeCrystals struct" do
      assert %State.ChargeCrystals{azure: 0, aether: 0, lucent: 0, transcendent: 0} =
               ChargeCrystals.default()
    end
  end

  describe "normalize/1" do
    test "handles nil" do
      assert %State.ChargeCrystals{azure: 0, aether: 0, lucent: 0, transcendent: 0} =
               ChargeCrystals.normalize(nil)
    end

    test "handles struct" do
      crystals = %State.ChargeCrystals{azure: 1, aether: 2, lucent: 3, transcendent: 4}
      assert ^crystals = ChargeCrystals.normalize(crystals)
    end

    test "handles map" do
      map = %{"azure" => 1, "aether" => 2, "lucent" => 3, "transcendent" => 4}

      assert %State.ChargeCrystals{azure: 1, aether: 2, lucent: 3, transcendent: 4} =
               ChargeCrystals.normalize(map)
    end
  end

  describe "visible_state/1" do
    test "returns map representing state" do
      crystals = %State.ChargeCrystals{azure: 1, aether: 2, lucent: 3, transcendent: 4}
      visible = ChargeCrystals.visible_state(crystals)
      assert visible["azure"] == 1
      assert visible["aether"] == 2
      assert visible["lucent"] == 3
      assert visible["transcendent"] == 4
    end
  end

  describe "count/2" do
    test "returns proper count for known tiers" do
      crystals = %State.ChargeCrystals{azure: 1, aether: 2, lucent: 3, transcendent: 4}
      assert ChargeCrystals.count(crystals, "azure") == 1
      assert ChargeCrystals.count(crystals, "aether") == 2
      assert ChargeCrystals.count(crystals, "lucent") == 3
      assert ChargeCrystals.count(crystals, "transcendent") == 4
    end

    test "returns 0 for unknown tiers" do
      crystals = %State.ChargeCrystals{azure: 1, aether: 2, lucent: 3, transcendent: 4}
      assert ChargeCrystals.count(crystals, "unknown") == 0
    end

    test "handles nil gracefully" do
      assert ChargeCrystals.count(nil, "azure") == 0
    end
  end

  describe "grant_claim/2" do
    test "grants azure when interval matches" do
      interval = Constants.charge_crystal_azure_claim_interval()

      crystals = ChargeCrystals.default()
      updated = ChargeCrystals.grant_claim(crystals, interval)

      assert updated.azure == 1
      assert updated.aether == 0
    end

    test "grants aether when interval matches" do
      interval = Constants.charge_crystal_aether_claim_interval()

      crystals = ChargeCrystals.default()
      updated = ChargeCrystals.grant_claim(crystals, interval)

      assert updated.aether == 1
    end

    test "does not grant when interval does not match" do
      crystals = ChargeCrystals.default()
      # assuming interval > 1
      updated = ChargeCrystals.grant_claim(crystals, 1)

      assert updated.azure == 0
      assert updated.aether == 0
    end

    test "handles invalid rewards_claimed gracefully" do
      crystals = ChargeCrystals.default()
      assert ChargeCrystals.grant_claim(crystals, 0) == crystals
      assert ChargeCrystals.grant_claim(crystals, -1) == crystals
      assert ChargeCrystals.grant_claim(crystals, nil) == crystals
    end
  end

  describe "grant_level_up/2" do
    test "grants lucent when interval matches" do
      interval = Constants.charge_crystal_lucent_level_interval()

      crystals = ChargeCrystals.default()
      updated = ChargeCrystals.grant_level_up(crystals, interval)

      assert updated.lucent == 1
      assert updated.transcendent == 0
    end

    test "grants transcendent when interval matches" do
      interval = Constants.charge_crystal_transcendent_level_interval()

      crystals = ChargeCrystals.default()
      updated = ChargeCrystals.grant_level_up(crystals, interval)

      assert updated.transcendent == 1
    end

    test "does not grant when interval does not match" do
      crystals = ChargeCrystals.default()
      # assuming interval > 1
      updated = ChargeCrystals.grant_level_up(crystals, 1)

      assert updated.lucent == 0
      assert updated.transcendent == 0
    end

    test "handles invalid level gracefully" do
      crystals = ChargeCrystals.default()
      assert ChargeCrystals.grant_level_up(crystals, 0) == crystals
      assert ChargeCrystals.grant_level_up(crystals, -1) == crystals
      assert ChargeCrystals.grant_level_up(crystals, nil) == crystals
    end
  end

  describe "spend/2" do
    test "successfully spends a crystal if available" do
      crystals = %State.ChargeCrystals{azure: 1, aether: 2, lucent: 3, transcendent: 4}

      assert {:ok, updated} = ChargeCrystals.spend(crystals, "azure")
      assert updated.azure == 0

      assert {:ok, updated2} = ChargeCrystals.spend(crystals, "aether")
      assert updated2.aether == 1

      assert {:ok, updated3} = ChargeCrystals.spend(crystals, "lucent")
      assert updated3.lucent == 2

      assert {:ok, updated4} = ChargeCrystals.spend(crystals, "transcendent")
      assert updated4.transcendent == 3
    end

    test "returns error if insufficient crystals" do
      crystals = %State.ChargeCrystals{azure: 0, aether: 0, lucent: 0, transcendent: 0}

      assert {:error, "insufficient_charge_crystals"} = ChargeCrystals.spend(crystals, "azure")
    end

    test "returns error if unknown tier" do
      crystals = %State.ChargeCrystals{azure: 1}

      assert {:error, "unknown_tier"} = ChargeCrystals.spend(crystals, "unknown")
    end
  end
end
