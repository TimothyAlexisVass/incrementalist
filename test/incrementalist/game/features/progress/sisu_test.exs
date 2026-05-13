defmodule Incrementalist.Game.Features.Progress.SisuTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Features.Progress.Sisu
  alias Incrementalist.Game.Features.Progress.Sisu.Levels
  alias Incrementalist.Game.State

  @now ~U[2026-05-04 12:00:00Z]

  test "upgrade costs are migrated from the legacy table" do
    assert Sisu.upgrade_cost(1) == BigNum.from_number(2_500)
    assert Sisu.upgrade_cost(13) == BigNum.from_number(15_000_000)
  end

  test "project_state/2 computes one-cycle projection values" do
    state = %State{
      first_played_at: DateTime.add(@now, -60, :second) |> DateTime.to_iso8601(),
      features: %State.Features{sisu_generator_purchased: true},
      progress_bar: %State.ProgressBar{},
      sisu: %State.Sisu{
        current: BigNum.from_number(2.0),
        max_basic: BigNum.from_number(Levels.base_max()),
        max_upgrade_level: 0,
        cycle_decay: 5.0,
        projected_at: DateTime.to_iso8601(@now)
      }
    }

    projected = Sisu.project_state(state, @now)

    assert projected.can_claim_at ==
             DateTime.add(@now, 2_273, :millisecond) |> DateTime.to_iso8601()

    assert_in_delta BigNum.to_float(projected.sisu.current), 2.0, 0.000001
    assert_in_delta projected.sisu.cycle_decay, 5.0, 0.000001
  end

  test "project_state/2 does not wall-clock decay sisu between checks" do
    state = %State{
      first_played_at: DateTime.add(@now, -60, :second) |> DateTime.to_iso8601(),
      features: %State.Features{sisu_generator_purchased: true},
      progress_bar: %State.ProgressBar{},
      sisu: %State.Sisu{
        current: BigNum.from_number(5.0),
        max_basic: BigNum.from_number(Levels.base_max()),
        max_upgrade_level: 0,
        cycle_decay: 8.0,
        projected_at: DateTime.to_iso8601(@now)
      }
    }

    first = Sisu.project_state(state, @now)
    second = Sisu.project_state(state, DateTime.add(@now, 5, :second))

    assert_in_delta BigNum.to_float(first.sisu.current), 5.0, 0.000001
    assert_in_delta BigNum.to_float(second.sisu.current), 5.0, 0.000001
    assert_in_delta first.sisu.cycle_decay, second.sisu.cycle_decay, 0.000001
  end

  test "advance_cycle/2 applies one cycle decay step" do
    state = %State{
      sisu: %State.Sisu{
        current: BigNum.from_number(5.0),
        target_current: BigNum.from_number(4.6),
        cycle_decay: 8.0,
        projected_at: DateTime.to_iso8601(@now)
      },
      progress_bar: %State.ProgressBar{},
      features: %State.Features{sisu_generator_purchased: true},
      first_played_at: DateTime.add(@now, -60, :second) |> DateTime.to_iso8601()
    }

    advanced = Sisu.advance_cycle(state, @now)

    assert_in_delta BigNum.to_float(advanced.sisu.current), 4.6, 0.000001
    # Verify that it cleared the old target and project_projection calculated the next decay step
    # 4.6 * (1 - 0.08) = 4.232
    assert_in_delta BigNum.to_float(advanced.sisu.target_current), 4.232, 0.000001
    assert_in_delta advanced.sisu.cycle_decay, 8.0, 0.000001
    # Note: target_cycle_decay will be softened
    assert_in_delta advanced.sisu.target_cycle_decay, 7.84, 0.000001
  end

  test "refill/3 and upgrade_max/2 return the narrow Sisu projection payload" do
    state = %State{
      shards: BigNum.from_number(3_000),
      charge_crystals: %State.ChargeCrystals{azure: 1, aether: 1, lucent: 0, transcendent: 0},
      features: %State.Features{sisu_generator_purchased: true},
      progress_bar: %State.ProgressBar{},
      first_played_at: DateTime.add(@now, -60, :second) |> DateTime.to_iso8601(),
      sisu: %State.Sisu{
        current: BigNum.from_number(1.0),
        max_basic: BigNum.from_number(Levels.base_max()),
        max_upgrade_level: 0,
        cycle_decay: 3.5,
        projected_at: DateTime.to_iso8601(@now)
      }
    }

    {:ok, refilled} = Sisu.refill(state, "aether", @now)

    # Deferred application: current stays at 1.0, target becomes 4.0
    assert_in_delta BigNum.to_float(refilled.sisu.current), 1.0, 0.000001
    assert_in_delta BigNum.to_float(refilled.sisu.target_current), 4.0, 0.000001
    assert refilled.sisu.target_cycle_decay == 4.5
    assert refilled.charge_crystals.aether == 0
    assert is_binary(refilled.can_claim_at)

    {:ok, upgraded} = Sisu.upgrade_max(state, @now)

    assert upgraded.sisu.max_upgrade_level == 1
    assert_in_delta BigNum.to_float(upgraded.sisu.max_basic), 2.5, 0.000001
    assert_in_delta BigNum.to_float(upgraded.shards), 500.0, 0.000001
    assert is_binary(upgraded.can_claim_at)
  end

  test "refill/3 supports transcendent charge crystals" do
    state = %State{
      charge_crystals: %State.ChargeCrystals{transcendent: 1},
      features: %State.Features{sisu_generator_purchased: true},
      progress_bar: %State.ProgressBar{},
      first_played_at: DateTime.add(@now, -60, :second) |> DateTime.to_iso8601(),
      sisu: %State.Sisu{
        current: BigNum.from_number(1.0),
        max_basic: BigNum.from_number(Levels.base_max()),
        max_upgrade_level: 0,
        cycle_decay: 3.5,
        projected_at: DateTime.to_iso8601(@now)
      }
    }

    {:ok, refilled} = Sisu.refill(state, "transcendent", @now)

    assert_in_delta BigNum.to_float(refilled.sisu.target_current), 20.0, 0.000001
    assert refilled.sisu.target_cycle_decay == 3.5
    assert refilled.charge_crystals.transcendent == 0
  end

  test "refill/3 rejects when the player lacks the matching charge crystal" do
    state = %State{
      charge_crystals: %State.ChargeCrystals{},
      features: %State.Features{sisu_generator_purchased: true},
      progress_bar: %State.ProgressBar{},
      first_played_at: DateTime.add(@now, -60, :second) |> DateTime.to_iso8601(),
      sisu: %State.Sisu{
        current: BigNum.from_number(1.0),
        max_basic: BigNum.from_number(Levels.base_max()),
        max_upgrade_level: 0,
        cycle_decay: 3.5,
        projected_at: DateTime.to_iso8601(@now)
      }
    }

    assert {:error, "insufficient_charge_crystals"} = Sisu.refill(state, "transcendent", @now)
  end
end
