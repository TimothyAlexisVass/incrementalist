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

        {total_fame, total_favor, last_claimed_rank} =
          Enum.reduce(ranks_to_claim, {BigNum.zero(), 0, quest.claimed_rank}, fn rank_index,
                                                                                 {acc_fame,
                                                                                  acc_favor,
                                                                                  last_rank} ->
            rank_def = quest_def.ranks[rank_index]

            if rank_def do
              {
                BigNum.add(acc_fame, rank_def.fame),
                acc_favor + (rank_def.favor || 1),
                rank_index
              }
            else
              {acc_fame, acc_favor, last_rank}
            end
          end)

        if last_claimed_rank > quest.claimed_rank do
          {new_trust, new_fame, new_required_fame} =
            apply_trust_level_ups(
              state.trust || 1,
              BigNum.add(state.fame || BigNum.zero(), total_fame),
              state.required_fame || required_fame_for_trust(state.trust || 1)
            )

          # Update quest state
          new_quests =
            Enum.map(state.quests, fn q ->
              if q.id == quest_id do
                %{q | claimed_rank: last_claimed_rank}
              else
                q
              end
            end)

          claims_count = last_claimed_rank - quest.claimed_rank

          # Update stats
          new_stats = %{
            state.stats
            | total_quests_claimed: state.stats.total_quests_claimed + claims_count,
              total_favor: state.stats.total_favor + total_favor
          }

          new_state = %{
            state
            | trust: new_trust,
              fame: new_fame,
              required_fame: new_required_fame,
              quests: new_quests,
              stats: new_stats
          }

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
      {final_rank, final_progress} =
        check_further_ranks(target_rank, progress, def.ranks, state, def.id)

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

  defp get_quest_value("streak", state),
    do: if(state.bonustime, do: state.bonustime.streak, else: 0)

  defp get_quest_value("clover_hunt", state) do
    clover_hunt = state.clover_hunt || %State.CloverHunt{}

    cond do
      clover_hunt.seven_leaf_found -> 4
      clover_hunt.six_leaf_found -> 3
      (clover_hunt.five_leaf_found_count || 0) >= 1 -> 2
      (clover_hunt.four_leaf_found_count || 0) >= 1 -> 1
      true -> 0
    end
  end

  defp get_quest_value("level_up_daily", state), do: state.stats.total_level_ups_daily
  defp get_quest_value(_, _), do: 0

  defp calculate_progress(current, requirement) when is_struct(current, BigNum) do
    case BigNum.compare(current, requirement) do
      1 ->
        1.0

      0 ->
        1.0

      -1 ->
        if BigNum.compare(requirement, BigNum.zero()) > 0 do
          BigNum.div(current, requirement) |> BigNum.to_float() |> min(1.0) |> Float.round(5)
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

  defp apply_trust_level_ups(trust, fame, required_fame) do
    if BigNum.compare(fame, required_fame) >= 0 do
      next_trust = trust + 1
      next_fame = BigNum.sub(fame, required_fame)
      next_required_fame = required_fame_for_trust(next_trust)
      apply_trust_level_ups(next_trust, next_fame, next_required_fame)
    else
      {trust, fame, required_fame}
    end
  end

  defp required_fame_for_trust(trust) do
    base = BigNum.from_number(trust)

    term =
      BigNum.mul(
        BigNum.from_number(Constants.trust_required_fame_base_multiplier()),
        BigNum.pow(base, 2)
      )

    required_fame =
      BigNum.add(term, BigNum.from_number(Constants.trust_required_fame_base_addition()))

    snap_small_required_fame(required_fame)
  end

  defp snap_small_required_fame(required_fame) do
    if BigNum.compare(
         required_fame,
         BigNum.from_number(Constants.trust_required_fame_small_snap_threshold())
       ) < 0 do
      rounded =
        round(BigNum.to_float(required_fame) / Constants.trust_required_fame_small_snap_step()) *
          Constants.trust_required_fame_small_snap_step()

      BigNum.from_number(rounded)
    else
      required_fame
    end
  end
end
