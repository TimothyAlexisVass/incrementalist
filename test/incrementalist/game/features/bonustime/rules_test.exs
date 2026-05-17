defmodule Incrementalist.Game.Features.BonusTime.RulesTest do
  use Incrementalist.DataCase
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Time
  alias Incrementalist.Game.Features.BonusTime.Rules
  alias Incrementalist.Game.Constants

  describe "spend_token/1" do
    test "spends daily token first" do
      state = %State{
        has_bonustime_token: true,
        bonustime: %State.BonusTime{special_tokens: 5}
      }

      assert {:ok, next_state, "daily"} = Rules.spend_token(state)
      assert next_state.has_bonustime_token == false
      assert next_state.bonustime.special_tokens == 5
    end

    test "falls back to special tokens if no daily token" do
      state = %State{
        has_bonustime_token: false,
        bonustime: %State.BonusTime{special_tokens: 5}
      }

      assert {:ok, next_state, "special"} = Rules.spend_token(state)
      assert next_state.has_bonustime_token == false
      assert next_state.bonustime.special_tokens == 4
    end

    test "returns error if no tokens available" do
      state = %State{
        has_bonustime_token: false,
        bonustime: %State.BonusTime{special_tokens: 0}
      }

      assert {:error, "no_tokens"} = Rules.spend_token(state)
    end
  end

  describe "advance_streak/2" do
    test "advances streak from 0 to 1 on first play" do
      now = Time.now()
      state = %State{
        bonustime: %State.BonusTime{
          streak: 0,
          last_played_at: nil
        }
      }

      next_state = Rules.advance_streak(state, now)
      assert next_state.bonustime.streak == 1
      assert next_state.bonustime.last_played_at == Time.iso8601(now)
    end

    test "does not advance streak if played on same day" do
      now = Time.now()
      state = %State{
        bonustime: %State.BonusTime{
          streak: 5,
          last_played_at: Time.iso8601(now)
        }
      }

      next_state = Rules.advance_streak(state, now)
      assert next_state.bonustime.streak == 5
      assert next_state.bonustime.last_played_at == Time.iso8601(now)
    end

    test "advances streak if played on consecutive day" do
      now = Time.now()
      yesterday = DateTime.add(now, -1, :day)
      state = %State{
        bonustime: %State.BonusTime{
          streak: 5,
          last_played_at: Time.iso8601(yesterday)
        }
      }

      next_state = Rules.advance_streak(state, now)
      assert next_state.bonustime.streak == 6
      assert next_state.bonustime.last_played_at == Time.iso8601(now)
    end

    test "penalizes streak by 3 per missed day and advances by 1" do
      now = Time.now()
      # Missed 2 days (played 3 days ago)
      three_days_ago = DateTime.add(now, -3, :day)

      state = %State{
        bonustime: %State.BonusTime{
          streak: 10,
          last_played_at: Time.iso8601(three_days_ago)
        }
      }

      # Penalty for 2 missed days: 2 * 3 = 6
      # Next streak: max(0, 10 - 6) = 4
      # Advance for today: 4 + 1 = 5
      next_state = Rules.advance_streak(state, now)
      assert next_state.bonustime.streak == 5
      assert next_state.bonustime.last_played_at == Time.iso8601(now)
    end

    test "streak penalty capped at 0" do
      now = Time.now()
      # Missed 5 days (played 6 days ago)
      six_days_ago = DateTime.add(now, -6, :day)

      state = %State{
        bonustime: %State.BonusTime{
          streak: 10,
          last_played_at: Time.iso8601(six_days_ago)
        }
      }

      # Penalty for 5 missed days: 5 * 3 = 15
      # Next streak: max(0, 10 - 15) = 0
      # Advance for today: 0 + 1 = 1
      next_state = Rules.advance_streak(state, now)
      assert next_state.bonustime.streak == 1
      assert next_state.bonustime.last_played_at == Time.iso8601(now)
    end
  end

  describe "get_active_game_id/1" do
    test "returns the right game id depending on elapsed time" do
      # Let's test with a fixed time exactly at the rotation anchor.
      anchor = Constants.bonustime_rotation_anchor_at()

      # Will rely on real constants to test integration.
      rotation = Constants.bonustime_rotation()

      assert Rules.get_active_game_id(anchor) == rotation["1"]

      # Fast forward 12 hours + 1 min
      next_slot_time = DateTime.add(anchor, 12 * 3600 + 60, :second)
      assert Rules.get_active_game_id(next_slot_time) == rotation["2"]
    end
  end
end
