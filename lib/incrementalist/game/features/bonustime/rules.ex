defmodule Incrementalist.Game.Features.BonusTime.Rules do
  @moduledoc """
  Rules for BonusTime rotation, tokens, and streaks.
  """
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Time
  alias Incrementalist.Game.Constants

  def spend_token(%State{} = state) do
    cond do
      state.has_bonustime_token ->
        {:ok, %{state | has_bonustime_token: false}, "daily"}

      state.bonustime.special_tokens > 0 ->
        new_db = %{state.bonustime | special_tokens: state.bonustime.special_tokens - 1}
        {:ok, %{state | bonustime: new_db}, "special"}

      true ->
        {:error, "no_tokens"}
    end
  end

  def advance_streak(%State{} = state, now) do
    played_day = Time.to_utc_day_index(now)

    previous_day =
      if state.bonustime.last_played_at do
        case Time.from_iso8601(state.bonustime.last_played_at) do
          {:ok, dt} -> Time.to_utc_day_index(dt)
          _ -> nil
        end
      else
        nil
      end

    streak_before = state.bonustime.streak || 0
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
          state.bonustime
          | streak: next_streak,
            last_played_at: Time.iso8601(now)
        }

        %{state | bonustime: new_db}

      previous_day == nil or played_day > previous_day ->
        # Next day
        next_streak = next_streak + 1

        new_db = %{
          state.bonustime
          | streak: next_streak,
            last_played_at: Time.iso8601(now)
        }

        %{state | bonustime: new_db}

      true ->
        state
    end
  end

  def get_active_game(now \\ Time.now()) do
    game_id = get_active_game_id(now)
    games = Constants.bonustime_games()
    games[game_id]
  end

  def get_active_game_id(now \\ Time.now()) do
    anchor_ms = Time.to_unix_ms(Constants.bonustime_rotation_anchor_at())
    now_ms = Time.to_unix_ms(now)

    elapsed = max(0, now_ms - anchor_ms)
    boundary_index = div(elapsed, Constants.bonustime_slot_ms())

    slot_count = Constants.bonustime_rotation_slot_count()
    active_slot_index = rem(boundary_index, slot_count) + 1

    rotation = Constants.bonustime_rotation()
    rotation[to_string(active_slot_index)]
  end
end
