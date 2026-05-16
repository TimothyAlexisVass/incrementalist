defmodule Incrementalist.Game.Features.DailyBonus.Rules do
  @moduledoc """
  Rules for Daily Bonus rotation, tokens, and streaks.
  """
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Time
  alias Incrementalist.Game.Constants

  def spend_token(%State{} = state) do
    cond do
      state.has_daily_token ->
        {:ok, %{state | has_daily_token: false}, "daily"}

      state.daily_bonus.special_tokens > 0 ->
        new_db = %{state.daily_bonus | special_tokens: state.daily_bonus.special_tokens - 1}
        {:ok, %{state | daily_bonus: new_db}, "special"}

      true ->
        {:error, "no_tokens"}
    end
  end

  def advance_streak(%State{} = state, now) do
    played_day = Time.to_utc_day_index(now)

    previous_day =
      if state.daily_bonus.last_played_at do
        case Time.from_iso8601(state.daily_bonus.last_played_at) do
          {:ok, dt} -> Time.to_utc_day_index(dt)
          _ -> nil
        end
      else
        nil
      end

    streak_before = state.daily_bonus.streak || 0
    next_streak = streak_before

    cond do
      previous_day == played_day ->
        # Already advanced today
        state

      previous_day != nil and played_day > previous_day + 1 ->
        # Streak broken, decrease by 3 per missed day!
        missed_days = played_day - previous_day - 1
        penalty = missed_days * 3
        next_streak = max(0, next_streak - penalty)

        # Advance it now for the current day play
        next_streak = next_streak + 1

        new_db = %{
          state.daily_bonus
          | streak: next_streak,
            last_played_at: Time.iso8601(now)
        }

        %{state | daily_bonus: new_db}

      previous_day == nil or played_day > previous_day ->
        # Next day
        next_streak = next_streak + 1

        new_db = %{
          state.daily_bonus
          | streak: next_streak,
            last_played_at: Time.iso8601(now)
        }

        %{state | daily_bonus: new_db}

      true ->
        state
    end
  end

  def get_active_game(now \\ Time.now()) do
    anchor_ms = Time.to_unix_ms(Constants.daily_bonus_rotation_anchor_at())
    now_ms = Time.to_unix_ms(now)

    elapsed = max(0, now_ms - anchor_ms)
    boundary_index = div(elapsed, Constants.daily_bonus_slot_ms())

    slot_count = Constants.daily_bonus_rotation_slot_count()
    active_slot_index = rem(boundary_index, slot_count) + 1
    
    rotation = Constants.daily_bonus_rotation()
    game_id = rotation[to_string(active_slot_index)]
    
    games = Constants.daily_bonus_games()
    games[game_id]
  end
end
