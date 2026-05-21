defmodule Incrementalist.Game.Features.BonusTime.Games.LuckyDiceTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Features.BonusTime.Games.LuckyDice
  alias Incrementalist.Game.Time

  test "throws_for_streak/1 follows configured thresholds" do
    assert LuckyDice.throws_for_streak(0) == 1
    assert LuckyDice.throws_for_streak(15) == 1
    assert LuckyDice.throws_for_streak(16) == 2
    assert LuckyDice.throws_for_streak(30) == 2
    assert LuckyDice.throws_for_streak(31) == 3
    assert LuckyDice.throws_for_streak(999) == 3
  end

  test "start_session/3 initializes a session that requires manual first throw" do
    now = Time.now()
    session = LuckyDice.start_session(31, "daily", now)

    assert session["throws_total"] == 3
    assert session["throws_remaining"] == 3
    assert session["current_dice"] == []
    assert session["held_indexes"] == []
    assert session["claimed_tiers"] == []
    assert session["current_tier"] == nil
    assert session["current_outcome"] == nil
  end

  test "throw/2 preserves held values while rerolling others" do
    now = Time.now()
    :rand.seed(:exsss, {77, 88, 99})
    session = LuckyDice.start_session(31, "daily", now)
    {:ok, first_throw_session} = LuckyDice.throw(session, [])
    assert length(first_throw_session["current_dice"]) == 7
    held_face = Enum.at(first_throw_session["current_dice"], 0)

    {:ok, held_session} = LuckyDice.throw(first_throw_session, [0])
    assert held_session["held_indexes"] == [0]

    {:ok, rolled_session} = LuckyDice.throw(held_session, [0])
    assert rolled_session["throws_remaining"] == 0
    assert Enum.at(rolled_session["current_dice"], 0) == held_face
  end

  test "claim/1 grants tier and continues until final board is exhausted" do
    now = Time.now()
    :rand.seed(:exsss, {101, 202, 303})
    session = LuckyDice.start_session(31, "daily", now)

    {:ok, first_throw_session} = LuckyDice.throw(session, [])
    assert first_throw_session["throws_remaining"] == 2
    assert length(first_throw_session["current_dice"]) == 7

    {:ok, first_claim} = LuckyDice.claim(first_throw_session)
    assert first_claim["tier"] in 1..7
    assert first_claim["final"] == false
    assert is_map(first_claim["session"])
    assert first_claim["session"]["throws_remaining"] == 2
    assert first_claim["session"]["current_dice"] == []
    assert length(first_claim["claimed_tiers"]) == 1
    assert length(first_claim["dice"]) == 7

    {:ok, second_throw_session} = LuckyDice.throw(first_claim["session"], [])
    assert second_throw_session["throws_remaining"] == 1

    {:ok, second_claim} = LuckyDice.claim(second_throw_session)
    assert second_claim["final"] == false
    assert is_map(second_claim["session"])
    assert second_claim["session"]["throws_remaining"] == 1

    {:ok, final_throw_session} = LuckyDice.throw(second_claim["session"], [])
    assert final_throw_session["throws_remaining"] == 0

    {:ok, final_claim} = LuckyDice.claim(final_throw_session)
    assert final_claim["tier"] in 1..7
    assert final_claim["final"] == true
    assert final_claim["session"] == nil
    assert length(final_claim["claimed_tiers"]) == 3
    assert length(final_claim["dice"]) == 7
  end

  test "evaluate_tier/1 resolves representative hands" do
    assert LuckyDice.evaluate_tier([7, 7, 7, 7, 7, 7, 7]) == 7
    assert LuckyDice.evaluate_tier([1, 2, 3, 4, 5, 6, 7]) == 6
    assert LuckyDice.evaluate_tier([5, 5, 5, 5, 5, 2, 2]) == 5
    assert LuckyDice.evaluate_tier([4, 4, 4, 4, 3, 3, 3]) == 3
    assert LuckyDice.evaluate_tier([2, 2, 2, 2, 1, 3, 4]) == 4
  end
end
