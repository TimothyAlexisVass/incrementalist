defmodule Incrementalist.Game.Features.Achievements.Rules do
  @moduledoc """
  Handles evaluation and unlocking of achievements.
  """
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Time

  def evaluate(%State{} = state) do
    defs = Constants.achievement_defs()
    now = Time.now() |> Time.iso8601()

    {updated_achievements, unlocked_count} =
      Enum.reduce(defs, {state.achievements || %{}, 0}, fn achievement_def, {acc, count} ->
        id = achievement_def.id
        if Map.has_key?(acc, id) do
          {acc, count + 1}
        else
          if condition_met?(achievement_def.condition, state) do
            {Map.put(acc, id, now), count + 1}
          else
            {acc, count}
          end
        end
      end)

    if updated_achievements != state.achievements or unlocked_count != state.stats.total_achievements do
      new_stats = %{state.stats | total_achievements: unlocked_count}
      %{state | achievements: updated_achievements, stats: new_stats}
    else
      state
    end
  end

  defp condition_met?(condition, state) do
    case condition do
      "tutorial_graduated" -> state.stats.tutorial_graduated
      "level_10" -> state.level >= 10
      "level_20" -> state.level >= 20
      "level_40" -> state.level >= 40
      "rewards_50" -> state.progress_bar.rewards_claimed >= 50
      "rewards_250" -> state.progress_bar.rewards_claimed >= 250
      "rewards_500" -> state.progress_bar.rewards_claimed >= 500
      "rewards_1000" -> state.progress_bar.rewards_claimed >= 1000
      "coins_50000" -> BigNum.compare(state.stats.total_coins_earned, BigNum.from_number(50_000)) >= 0
      "coins_100000" -> BigNum.compare(state.stats.total_coins_earned, BigNum.from_number(100_000)) >= 0
      "shards_2500" -> BigNum.compare(state.stats.total_shards_earned, BigNum.from_number(2500)) >= 0
      "cores_100" -> BigNum.compare(state.stats.total_cores_earned, BigNum.from_number(100)) >= 0
      "screens_viewed_stats" -> state.stats.screens_viewed_stats
      "screens_viewed_quests" -> state.stats.screens_viewed_quests
      "screens_viewed_achievements" -> state.stats.screens_viewed_achievements
      _ -> false
    end
  end
end
