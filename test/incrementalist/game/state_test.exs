defmodule Incrementalist.Game.StateTest do
  use Incrementalist.DataCase, async: true

  alias Incrementalist.Game.State
  alias Incrementalist.Game.Time

  @now ~U[2024-05-01 12:00:00.000000Z]

  describe "new/1" do
    test "creates a new state with default values" do
      state = State.new(@now)
      timestamp = Time.iso8601(@now)

      assert state.version == 1
      assert state.area == "sage"
      assert state.level == 1
      assert state.has_bonustime_token == true
      assert BigNum.to_float(state.exp) == 0.0
      assert BigNum.to_float(state.required_exp) == 20.0
      assert BigNum.to_float(state.coins) == 0.0
      assert BigNum.to_float(state.shards) == 0.0
      assert BigNum.to_float(state.cores) == 0.0
      assert state.idle_mode == false
      assert state.first_played_at == timestamp
      assert state.last_claimed_at == timestamp
      assert state.cycle_started_at == timestamp
      assert state.can_claim_at == nil
      assert state.saved_at == timestamp

      assert state.progress_bar.reward_multiplier == 1.0
      assert state.progress_bar.rewards_claimed == 0

      assert state.features.idle_mode_purchased == false
      assert state.features.world_map_unlocked == false
      assert state.features.sisu_generator_purchased == false
      assert state.features.bonus_time_purchased == false

      assert BigNum.to_float(state.sisu.current) == 1.0
      assert BigNum.to_float(state.sisu.target_current) == 1.0
      assert state.sisu.active_tier == "azure"

      assert state.quests == []
      assert state.achievements == %{}

      assert BigNum.to_float(state.stats.total_coins_earned) == 0.0
      assert BigNum.to_float(state.stats.total_shards_earned) == 0.0
      assert BigNum.to_float(state.stats.total_cores_earned) == 0.0
      assert state.stats.last_reset_at == timestamp
    end
  end

  describe "check_daily_reset/2" do
    test "does not reset when on the same day" do
      state = State.new(@now)
      same_day = ~U[2024-05-01 23:59:59.000000Z]

      updated_state = State.check_daily_reset(state, same_day)

      assert updated_state.has_bonustime_token == state.has_bonustime_token
      assert updated_state.stats.total_days_played == 0
      assert updated_state.stats.last_reset_at == state.stats.last_reset_at
    end

    test "resets when on the next day" do
      state = State.new(@now)
      state = %{state | has_bonustime_token: false, stats: %{state.stats | total_level_ups_daily: 5, total_days_played: 1}}

      next_day = ~U[2024-05-02 00:00:01.000000Z]

      updated_state = State.check_daily_reset(state, next_day)

      assert updated_state.has_bonustime_token == true
      assert updated_state.stats.total_level_ups_daily == 0
      assert updated_state.stats.total_days_played == 2
      assert updated_state.stats.last_reset_at == Time.iso8601(next_day)
    end
  end

  describe "touch_saved_at/2" do
    test "returns a new state with saved_at when state is nil" do
      state = State.touch_saved_at(nil, @now)

      assert state.saved_at == Time.iso8601(@now)
      assert state.first_played_at == Time.iso8601(@now)
    end

    test "updates saved_at when state is provided" do
      state = State.new(~U[2024-05-01 12:00:00.000000Z])
      later = ~U[2024-05-01 12:30:00.000000Z]

      updated_state = State.touch_saved_at(state, later)

      assert updated_state.saved_at == Time.iso8601(later)
      assert updated_state.first_played_at == state.first_played_at
    end
  end

  describe "visible_state/2" do
    test "projects a nil state as a new default state" do
      visible = State.visible_state(nil, @now)

      assert visible["area"] == "sage"
      assert visible["level"] == 1
      assert visible["first_played_at"] == Time.iso8601(@now)
    end

    test "projects a state properly" do
      state = State.new(@now)
      visible = State.visible_state(state, @now)

      assert visible["area"] == "sage"
      assert visible["level"] == 1
      assert BigNum.to_float(visible["exp"]) == 0.0
      assert visible["progress_bar"]["reward_multiplier"] == 1.0
      assert visible["features"]["idle_mode_purchased"] == false
      assert BigNum.to_float(visible["sisu"]["current"]) == 1.0
    end
  end

  describe "projection_params/2" do
    test "calculates current_fill based on cycle time" do
      start_time = ~U[2024-05-01 12:00:00.000000Z]
      end_time = ~U[2024-05-01 12:01:40.000000Z] # 100 seconds
      mid_time = ~U[2024-05-01 12:00:50.000000Z] # 50 seconds (50%)

      state = State.new(start_time)
      state = %{state | can_claim_at: Time.iso8601(end_time)}

      params = State.projection_params(state, mid_time)

      assert_in_delta params["current_fill"], 50.0, 0.1
    end

    test "clamps current_fill between 0 and 100" do
      start_time = ~U[2024-05-01 12:00:00.000000Z]
      end_time = ~U[2024-05-01 12:01:40.000000Z] # 100 seconds

      before_time = ~U[2024-05-01 11:59:50.000000Z]
      after_time = ~U[2024-05-01 12:02:50.000000Z]

      state = State.new(start_time)
      state = %{state | can_claim_at: Time.iso8601(end_time)}

      params_before = State.projection_params(state, before_time)
      assert params_before["current_fill"] == 0.0

      params_after = State.projection_params(state, after_time)
      assert params_after["current_fill"] == 100.0
    end

    test "returns 0 current_fill if dates are missing" do
      state = State.new(@now)
      # new states have can_claim_at = nil
      params = State.projection_params(state, @now)

      assert params["current_fill"] == 0.0
    end
  end
end