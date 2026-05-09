defmodule Incrementalist.Game.Features.Progress.BarTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Features.Progress.Bar

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
          sisu: BigNum.from_number(1),
          reward_multiplier: 1.0
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
        progress_bar: %State.ProgressBar{sisu: BigNum.from_number(2.0)}
      }

      # @base_idle_mode_on_fill_rate * sisu = 0.24 * 2.0 = 0.48
      assert Bar.get_progress_bar_fill_rate(state, now) == 0.48
    end

    test "applies new player bonus when game age < 25_000ms", %{now: now} do
      first_played = DateTime.add(now, -10_000, :millisecond) |> DateTime.to_iso8601()
      state = %State{
        idle_mode: false,
        first_played_at: first_played,
        progress_bar: %State.ProgressBar{sisu: BigNum.from_number(1.0)}
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
        progress_bar: %State.ProgressBar{sisu: BigNum.from_number(1.0)}
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
        progress_bar: %State.ProgressBar{sisu: BigNum.from_number(1.0)}
      }

      # base_rate = 0.8 * 1.0 = 0.8
      assert Bar.get_progress_bar_fill_rate(state, now) == 0.8
    end

    test "falls back to now when first_played_at is nil or invalid, giving new player bonus", %{now: now} do
      # Test nil
      state_nil = %State{
        idle_mode: false,
        first_played_at: nil,
        progress_bar: %State.ProgressBar{sisu: BigNum.from_number(1.0)}
      }
      # game age = 0, so bonus applies
      assert Bar.get_progress_bar_fill_rate(state_nil, now) == 22.0

      # Test invalid
      state_invalid = %State{
        idle_mode: false,
        first_played_at: "invalid_date",
        progress_bar: %State.ProgressBar{sisu: BigNum.from_number(1.0)}
      }
      assert Bar.get_progress_bar_fill_rate(state_invalid, now) == 22.0
    end

    test "scales base rate appropriately with sisu", %{now: now} do
      first_played = DateTime.add(now, -30_000, :millisecond) |> DateTime.to_iso8601()
      state = %State{
        idle_mode: false,
        first_played_at: first_played,
        level: 35,
        progress_bar: %State.ProgressBar{sisu: BigNum.from_number(10.0)}
      }

      # base_rate = 0.8 * 10.0 = 8.0
      assert Bar.get_progress_bar_fill_rate(state, now) == 8.0
    end
  end
end
