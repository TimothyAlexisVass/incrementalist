defmodule Incrementalist.Game.Features.Quests.Rules do
  @moduledoc """
  Handles evaluation of quest progress and claiming rewards.
  """
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.State
  alias Incrementalist.Game.State.QuestState

  def evaluate(%State{} = state) do
    defs = Constants.quest_defs()

    updated_quests =
      defs
      |> Enum.map(fn {id, quest_def} ->
        current_quest = Enum.find(state.quests, &(&1.id == id)) || %QuestState{id: id}
        evaluate_quest(current_quest, quest_def, state)
      end)
      |> Enum.sort_by(& &1.id)

    %{state | quests: updated_quests}
  end

  def claim(%State{} = state, quest_id) do
    quest = Enum.find(state.quests, &(&1.id == quest_id))
    quest_def = Constants.quest_defs()[quest_id]

    cond do
      is_nil(quest) or is_nil(quest_def) ->
        {:error, "quest_not_found"}

      quest.claimed_rank >= quest.rank ->
        {:error, "no_rewards_to_claim"}

      true ->
        ranks_to_claim = (quest.claimed_rank + 1)..quest.rank

        {total_reward, last_claimed_rank} =
          Enum.reduce(ranks_to_claim, {BigNum.zero(), quest.claimed_rank}, fn rank_index, {acc, last_rank} ->
            rank_def = quest_def.ranks[rank_index]
            if rank_def do
              {BigNum.add(acc, rank_def.reward), rank_index}
            else
              {acc, last_rank}
            end
          end)

        if last_claimed_rank > quest.claimed_rank do
          new_coins = BigNum.add(state.coins, total_reward)

          # Update quest state
          new_quests = Enum.map(state.quests, fn q ->
            if q.id == quest_id do
              %{q | claimed_rank: last_claimed_rank}
            else
              q
            end
          end)

          claims_count = last_claimed_rank - quest.claimed_rank

          # Update stats
          new_stats = %{state.stats |
            total_quests_claimed: state.stats.total_quests_claimed + claims_count,
            total_coins_earned: BigNum.add(state.stats.total_coins_earned, total_reward)
          }

          new_state = %{state | coins: new_coins, quests: new_quests, stats: new_stats}

          # Re-evaluate in case claiming one quest affects another (e.g. quest_c_rank)
          {:ok, evaluate(new_state)}
        else
          {:error, "rank_definition_not_found"}
        end
    end
  end


  defp evaluate_quest(quest, def, state) do
    # We evaluate the next rank after claimed_rank.
    # If the user has claimed rank 1, we evaluate rank 2.
    # If they haven't claimed rank 1 but completed it, rank will be 1 and claimed_rank will be 0.
    
    target_rank = quest.claimed_rank + 1
    rank_def = def.ranks[target_rank]

    if rank_def do
      current_value = get_quest_value(def.id, state)
      requirement = rank_def.requirement

      progress = calculate_progress(current_value, requirement)

      # However, what if they completed MULTIPLE ranks?
      # We should probably check subsequent ranks too if progress is 1.0.
      {final_rank, final_progress} = check_further_ranks(target_rank, progress, def.ranks, state, def.id)

      # If we have a rank ready to claim, show 100% progress for the current target.
      display_progress = if final_rank > quest.claimed_rank, do: 1.0, else: final_progress

      %{quest | rank: max(quest.rank, final_rank), progress: display_progress}
    else
      # All ranks completed and claimed
      %{quest | progress: 1.0}
    end
  end

  defp check_further_ranks(current_rank, progress, ranks, state, quest_id) when progress >= 1.0 do
    next_rank = current_rank + 1
    next_rank_def = ranks[next_rank]
    if next_rank_def do
      current_value = get_quest_value(quest_id, state)
      next_progress = calculate_progress(current_value, next_rank_def.requirement)
      if next_progress >= 1.0 do
        check_further_ranks(next_rank, next_progress, ranks, state, quest_id)
      else
        {current_rank, next_progress}
      end
    else
      {current_rank, 1.0}
    end
  end

  defp check_further_ranks(current_rank, progress, _ranks, _state, _quest_id) do
    {current_rank - 1, progress}
  end

  defp get_quest_value("level_up", state), do: state.level
  defp get_quest_value("achievements", state), do: state.stats.total_achievements
  defp get_quest_value("quest_c_rank", state), do: state.stats.total_quests_claimed
  defp get_quest_value("coins", state), do: state.stats.total_coins_earned
  defp get_quest_value("shards", state), do: state.stats.total_shards_earned
  defp get_quest_value("cores", state), do: state.stats.total_cores_earned
  defp get_quest_value("progress_claim", state), do: state.stats.total_progress_claims
  defp get_quest_value("streak", state), do: if(state.bonustime, do: state.bonustime.streak, else: 0)
  defp get_quest_value("level_up_daily", state), do: state.stats.total_level_ups_daily
  defp get_quest_value(_, _), do: 0

  defp calculate_progress(current, requirement) when is_struct(current, BigNum) do
    case BigNum.compare(current, requirement) do
      1 -> 1.0
      0 -> 1.0
      -1 ->
        if BigNum.compare(requirement, BigNum.zero()) > 0 do
          {:ok, result} = BigNum.div(current, requirement)
          result |> BigNum.to_float() |> min(1.0) |> Float.round(5)
        else
          1.0
        end
    end
  end

  defp calculate_progress(current, requirement) when is_number(current) do
    if requirement > 0 do
      (current / requirement) |> min(1.0) |> max(0.0) |> Float.round(5)
    else
      1.0
    end
  end
end
