defmodule Incrementalist.Game.Features.BonusTime.Games.MatchPairs do
  @moduledoc """
  Match Pairs daily bonus mini-game rules.
  """
  alias Incrementalist.Game.Constants

  def generate_session(streak) do
    rules = Constants.bonustime_game_rules()["match_pairs"]
    turn_rules = rules["turn_count"]

    turn_count =
      turn_rules["base"] +
        min(div(max(0, streak), turn_rules["streak_divisor"]), turn_rules["max_bonus"])

    results =
      Enum.map(1..turn_count, fn _ ->
        if :rand.uniform() <= 0.6 do
          %{"kind" => "match", "tier" => roll_tier(rules["chances"])}
        else
          %{"kind" => "miss"}
        end
      end)

    %{"results" => results}
  end

  def evaluate_claim(rolled_results, discarded_tiers) do
    # rolled_results is a list of %{"kind" => "match", "tier" => tier} or %{"kind" => "miss"}
    # discarded_tiers is a list of strings like ["tier_1", "tier_2"]

    rolled_matches =
      rolled_results
      |> Enum.filter(&(&1["kind"] == "match"))
      |> Enum.map(& &1["tier"])

    # Subtract discarded_tiers from rolled_matches
    completed_matches = subtract_lists(rolled_matches, discarded_tiers)

    completed_matches
  end

  defp subtract_lists(base_list, to_remove) do
    Enum.reduce(to_remove, base_list, fn item, acc ->
      delete_first(acc, item)
    end)
  end

  defp delete_first(list, item) do
    case Enum.find_index(list, &(&1 == item)) do
      nil -> list
      index -> List.delete_at(list, index)
    end
  end

  defp roll_tier(chances) do
    r = :rand.uniform()

    {_, index} =
      Enum.reduce_while(chances, {0.0, 0}, fn chance, {acc, idx} ->
        new_acc = acc + chance

        if r <= new_acc do
          {:halt, {new_acc, idx}}
        else
          {:cont, {new_acc, idx + 1}}
        end
      end)

    # 1-indexed tier
    "tier_#{index + 1}"
  end
end
