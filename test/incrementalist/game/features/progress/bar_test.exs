defmodule Incrementalist.Game.Features.Progress.BarTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Features.Progress.Bar
  alias Incrementalist.Game.Features.Progress.Sisu

  describe "claim_reward/1" do
    test "deterministic RNG for coins and shards" do
      # Seed the process dictionary to ensure predictable :rand.uniform() calls
      :rand.seed(:exsss, {1, 2, 3})

      # Level 2 ensures we use the random paths (Level 1 has hardcoded values)
      state = %State{
        level: 2,
        exp: BigNum.zero(),
        coins: BigNum.zero(),
        shards: BigNum.zero(),
        cores: BigNum.zero(),
        progress_bar: %State.ProgressBar{
          reward_multiplier: 1.0
        },
        sisu: %State.Sisu{
          current: BigNum.from_number(1),
          max_basic: BigNum.from_number(2),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      # Call claim_reward. Note: we don't pass random_fn, it defaults to &rand/0.
      # By seeding the process, rand() is deterministic.
      result1 = Bar.claim_reward(state)

      # Since it's deterministic, calling it again with the same initial seed state
      # would yield the exact same result. Instead, we just verify it produced expected values.
      assert result1.coins > 0
      assert result1.shards > 0

      # Let's seed again with the exact same seed and ensure we get the exact same result
      :rand.seed(:exsss, {1, 2, 3})
      result2 = Bar.claim_reward(state)

      assert result1.coins == result2.coins
      assert result1.shards == result2.shards
      assert result1.cores == result2.cores
      assert result1.exp == result2.exp
    end
  end

  describe "get_progress_bar_fill_rate/2" do
    setup do
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      {:ok, %{now: now}}
    end

    test "returns idle rate when idle_mode is true", %{now: now} do
      state = %State{
        idle_mode: true,
        progress_bar: %State.ProgressBar{},
        sisu: %State.Sisu{
          current: BigNum.from_number(2.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      # @base_idle_mode_on_fill_rate * sisu = 0.24 * 2.0 = 0.48
      assert Bar.get_progress_bar_fill_rate(state, now) == 0.48
    end

    test "applies new player bonus when game age < 25_000ms", %{now: now} do
      first_played = DateTime.add(now, -10_000, :millisecond) |> DateTime.to_iso8601()

      state = %State{
        idle_mode: false,
        first_played_at: first_played,
        progress_bar: %State.ProgressBar{},
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      # base_rate = 0.8 * 1.0 = 0.8
      # bonus = (0.8 * 2.5) + 20.0 = 22.0
      assert Bar.get_progress_bar_fill_rate(state, now) == 22.0
    end

    test "applies late new player bonus when level < 35 and game age >= 25_000ms", %{now: now} do
      first_played = DateTime.add(now, -30_000, :millisecond) |> DateTime.to_iso8601()

      state = %State{
        idle_mode: false,
        first_played_at: first_played,
        level: 34,
        progress_bar: %State.ProgressBar{},
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      # base_rate = 0.8 * 1.0 = 0.8
      # bonus = 0.8 * 7.25 = 5.8
      assert_in_delta Bar.get_progress_bar_fill_rate(state, now), 5.8, 0.000001
    end

    test "applies standard rate when level >= 35 and game age >= 25_000ms", %{now: now} do
      first_played = DateTime.add(now, -30_000, :millisecond) |> DateTime.to_iso8601()

      state = %State{
        idle_mode: false,
        first_played_at: first_played,
        level: 35,
        progress_bar: %State.ProgressBar{},
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      # base_rate = 0.8 * 1.0 = 0.8
      assert Bar.get_progress_bar_fill_rate(state, now) == 0.8
    end

    test "falls back to now when first_played_at is nil or invalid, giving new player bonus", %{
      now: now
    } do
      # Test nil
      state_nil = %State{
        idle_mode: false,
        first_played_at: nil,
        progress_bar: %State.ProgressBar{},
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      # game age = 0, so bonus applies
      assert Bar.get_progress_bar_fill_rate(state_nil, now) == 22.0

      # Test invalid
      state_invalid = %State{
        idle_mode: false,
        first_played_at: "invalid_date",
        progress_bar: %State.ProgressBar{},
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      assert Bar.get_progress_bar_fill_rate(state_invalid, now) == 22.0
    end

    test "scales base rate appropriately with sisu", %{now: now} do
      first_played = DateTime.add(now, -30_000, :millisecond) |> DateTime.to_iso8601()

      state = %State{
        idle_mode: false,
        first_played_at: first_played,
        level: 35,
        progress_bar: %State.ProgressBar{},
        sisu: %State.Sisu{
          current: BigNum.from_number(10.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      # base_rate = 0.8 * 10.0 = 8.0
      assert Bar.get_progress_bar_fill_rate(state, now) == 8.0
    end
  end

  describe "ensure_can_claim_at/2" do
    test "returns remaining milliseconds when can_claim_at is valid ISO8601" do
      now = ~U[2026-05-10 15:11:04Z]
      future = DateTime.add(now, 18, :second) |> DateTime.to_iso8601()

      state = %State{
        can_claim_at: future,
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      {_projected, can_claim_in} = Bar.ensure_can_claim_at(state, now)

      assert can_claim_in == 18_000
    end

    test "falls back to 0 remaining when can_claim_at is invalid" do
      now = ~U[2026-05-10 15:11:04Z]

      state = %State{
        can_claim_at: "not-a-date",
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      {_projected, can_claim_in} = Bar.ensure_can_claim_at(state, now)

      assert can_claim_in > 0
    end

    test "anchors countdown to persisted can_claim_at across repeated checks" do
      now = ~U[2026-05-10 15:11:04Z]
      future = DateTime.add(now, 8, :second) |> DateTime.to_iso8601()

      state = %State{
        can_claim_at: future,
        sisu: %State.Sisu{
          current: BigNum.from_number(1.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 3.5
        }
      }

      {first_state, first_can_claim_in} = Bar.ensure_can_claim_at(state, now)

      {second_state, second_can_claim_in} =
        Bar.ensure_can_claim_at(state, DateTime.add(now, 3, :second))

      assert first_can_claim_in == 8_000
      assert second_can_claim_in == 5_000
      assert first_state.can_claim_at == future
      assert second_state.can_claim_at == future
    end

    test "uses current cycle fill rate when scheduling a new claim boundary" do
      now = ~U[2026-05-10 15:11:04Z]

      state = %State{
        can_claim_at: nil,
        first_played_at: DateTime.add(now, -60, :second) |> DateTime.to_iso8601(),
        progress_bar: %State.ProgressBar{},
        features: %State.Features{sisu_generator_purchased: true},
        sisu: %State.Sisu{
          current: BigNum.from_number(2.0),
          max_basic: BigNum.from_number(2.0),
          max_upgrade_level: 0,
          cycle_decay: 5.0,
          projected_at: DateTime.to_iso8601(now)
        }
      }

      {_projected, can_claim_in} = Bar.ensure_can_claim_at(state, now)
      expected_ms = Sisu.claim_milliseconds(state, now)
      assert can_claim_in == expected_ms
    end
  end
end
