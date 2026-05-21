defmodule Incrementalist.Game.Features.BonusTime.Games.LuckyDice do
  @moduledoc """
  Lucky Dice (7x7 Dice) stateful bonus game rules.

  The server owns the session board, held dice, throw count, and hand evaluation.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Time

  @dice_count 7

  def throws_for_streak(streak) when is_integer(streak) do
    throw_budget = Map.fetch!(rules(), "throw_budget")
    first_max = Map.fetch!(throw_budget, "first_max_streak")
    second_max = Map.fetch!(throw_budget, "second_max_streak")
    first_throws = Map.fetch!(throw_budget, "first_throws")
    second_throws = Map.fetch!(throw_budget, "second_throws")
    third_throws = Map.fetch!(throw_budget, "third_throws")
    normalized_streak = max(0, streak)

    cond do
      normalized_streak <= first_max -> first_throws
      normalized_streak <= second_max -> second_throws
      true -> third_throws
    end
  end

  def start_session(streak, token_type, now \\ Time.now()) do
    total_throws = throws_for_streak(streak)

    %{
      "throws_total" => total_throws,
      "throws_remaining" => total_throws,
      "current_dice" => [],
      "held_indexes" => [],
      "claimed_tiers" => [],
      "current_tier" => nil,
      "current_outcome" => nil,
      "token_type" => token_type,
      "started_at" => Time.iso8601(now)
    }
  end

  def throw(session, held_indexes) when is_list(held_indexes) do
    with :ok <- validate_session(session),
         {:ok, held_indexes} <- validate_held_indexes(session, held_indexes),
         true <- Map.fetch!(session, "throws_remaining") > 0 do
      current_dice = Map.get(session, "current_dice", [])
      roll_all = not full_dice_board?(current_dice)

      next_dice =
        if roll_all do
          roll_dice()
        else
          held_indexes_set = MapSet.new(held_indexes)

          current_dice
          |> Enum.with_index()
          |> Enum.map(fn {face, index} ->
            if MapSet.member?(held_indexes_set, index), do: face, else: roll_face()
          end)
        end

      next_throws_remaining = max(Map.fetch!(session, "throws_remaining") - 1, 0)
      hand = evaluate_hand(next_dice)

      {:ok,
       session
       |> Map.put("current_dice", next_dice)
       |> Map.put("held_indexes", held_indexes)
       |> Map.put("throws_remaining", next_throws_remaining)
       |> Map.put("current_tier", hand.tier)
       |> Map.put("current_outcome", hand.outcome)}
    else
      false -> {:error, "no_throws_left"}
      {:error, reason} -> {:error, reason}
    end
  end

  def claim(session) do
    with :ok <- validate_session(session),
         true <- full_dice_board?(Map.get(session, "current_dice")),
         true <- is_integer(Map.get(session, "current_tier")) do
      current_dice = Map.fetch!(session, "current_dice")
      hand = evaluate_hand(current_dice)
      throws_remaining = Map.fetch!(session, "throws_remaining")
      claimed_tiers = Map.get(session, "claimed_tiers", []) ++ [hand.tier]

      if throws_remaining > 0 do
        next_session =
          session
          |> Map.put("current_dice", [])
          |> Map.put("held_indexes", [])
          |> Map.put("claimed_tiers", claimed_tiers)
          |> Map.put("current_tier", nil)
          |> Map.put("current_outcome", nil)

        {:ok,
         %{
           "tier" => hand.tier,
           "outcome" => hand.outcome,
           "claimed_tiers" => claimed_tiers,
           "dice" => current_dice,
           "final" => false,
           "session" => next_session
         }}
      else
        {:ok,
         %{
           "tier" => hand.tier,
           "outcome" => hand.outcome,
           "claimed_tiers" => claimed_tiers,
           "dice" => current_dice,
           "final" => true,
           "session" => nil
         }}
      end
    else
      false -> {:error, "claim_not_ready"}
      {:error, reason} -> {:error, reason}
    end
  end

  def evaluate_tier(dice) do
    evaluate_hand(dice).tier
  end

  def evaluate_outcome(dice) do
    evaluate_hand(dice).outcome
  end

  defp evaluate_hand(dice) when is_list(dice) do
    freq_map = frequency_map(dice)
    signature = signature(freq_map)
    {full_straight, large_straight, small_straight} = straight_flags(dice)
    has_any_straight = full_straight or large_straight or small_straight

    base_candidate =
      case signature do
        [7] ->
          {7, "Seven-of-a-kind"}

        [6, 1] ->
          {6, "Six-of-a-kind"}

        [5, 2] ->
          {5, "Five + pair"}

        [5, 1, 1] ->
          {5, "Five-of-a-kind"}

        [4, 3] ->
          {3, "Four + three"}

        [4, 2, 1] ->
          {1, "Four-of-a-kind + pair"}

        [4, 1, 1, 1] ->
          {4, "Four-of-a-kind"}

        [3, 3, 1] ->
          {2, "Two triples"}

        [3, 2, 2] ->
          {2, "Full house + pair"}

        [3, 2, 1, 1] ->
          {1, "Full house"}

        [3, 1, 1, 1, 1] ->
          {3, "Three-of-a-kind"}

        [2, 2, 2, 1] ->
          {2, "Three pairs"}

        [2, 2, 1, 1, 1] ->
          {1, "Two pairs"}

        [2, 1, 1, 1, 1, 1] ->
          pair_face = pair_face(freq_map)

          cond do
            has_any_straight -> nil
            pair_face == 7 -> {5, "7-leaf clover"}
            pair_face in 1..6 -> {4, "Single pair"}
            true -> nil
          end

        _ ->
          nil
      end

    straight_candidates =
      []
      |> maybe_push(full_straight, {6, "Full straight"})
      |> maybe_push(large_straight, {4, "Large straight"})
      |> maybe_push(small_straight, {5, "Small straight"})

    candidates =
      case base_candidate do
        nil -> straight_candidates
        candidate -> [candidate | straight_candidates]
      end

    case Enum.max_by(candidates, fn {tier, _outcome} -> tier end, fn -> {1, "Full house"} end) do
      {tier, outcome} -> %{tier: tier, outcome: outcome}
    end
  end

  defp evaluate_hand(_), do: %{tier: 1, outcome: "Full house"}

  defp frequency_map(dice) do
    Enum.reduce(dice, %{}, fn face, acc ->
      Map.update(acc, face, 1, &(&1 + 1))
    end)
  end

  defp signature(freq_map) do
    freq_map
    |> Map.values()
    |> Enum.sort(:desc)
  end

  defp pair_face(freq_map) do
    freq_map
    |> Enum.find_value(fn
      {face, 2} -> face
      _ -> nil
    end)
  end

  defp straight_flags(dice) do
    faces = MapSet.new(dice)
    full_straight = MapSet.size(faces) == 7
    large_straight = has_consecutive(faces, 1, 6) or has_consecutive(faces, 2, 6)

    small_straight =
      has_consecutive(faces, 1, 5) or has_consecutive(faces, 2, 5) or has_consecutive(faces, 3, 5)

    {full_straight, large_straight, small_straight}
  end

  defp has_consecutive(faces, start_face, length) do
    Enum.all?(start_face..(start_face + length - 1), &MapSet.member?(faces, &1))
  end

  defp maybe_push(list, true, value), do: [value | list]
  defp maybe_push(list, _condition, _value), do: list

  defp validate_held_indexes(session, held_indexes) when is_list(held_indexes) do
    current_dice = Map.get(session, "current_dice", [])
    normalized = normalize_indexes(held_indexes)

    cond do
      current_dice == [] and held_indexes == [] ->
        {:ok, []}

      current_dice == [] ->
        {:error, "invalid_request"}

      length(normalized) == length(held_indexes) ->
        {:ok, normalized}

      true ->
        {:error, "invalid_index"}
    end
  end

  defp validate_held_indexes(_session, _held_indexes), do: {:error, "invalid_index"}

  defp full_dice_board?(dice) when is_list(dice) do
    length(dice) == @dice_count and Enum.all?(dice, &(&1 in 1..7))
  end

  defp full_dice_board?(_), do: false

  defp validate_session(%{
         "throws_total" => total,
         "throws_remaining" => remaining,
         "current_dice" => dice
       })
       when is_integer(total) and is_integer(remaining) and is_list(dice) do
    if dice == [] or full_dice_board?(dice) do
      :ok
    else
      {:error, "invalid_session"}
    end
  end

  defp validate_session(_session), do: {:error, "invalid_session"}

  defp normalize_indexes(indexes) do
    indexes
    |> Enum.filter(&is_integer/1)
    |> Enum.filter(&(&1 in 0..(@dice_count - 1)))
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp roll_dice do
    Enum.map(1..@dice_count, fn _ -> roll_face() end)
  end

  defp roll_face do
    :rand.uniform(7)
  end

  defp rules do
    Map.fetch!(Constants.bonustime_game_rules(), "lucky_dice")
  end
end
