defmodule Incrementalist.Game.Features.BonusTime.JackpotRulesTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.JackpotRules
  alias Incrementalist.Game.State

  setup do
    state = State.new()
    {:ok, state: state}
  end

  test "play/1 increments progress on miss and rolls consolation tier 1-6", %{state: state} do
    # Initial jackpot progress is 0
    assert state.bonustime.jackpot_progress == 0

    # Execute a play. It either hits or misses.
    # Since base chance is very small (0.5%), it will almost certainly miss.
    {:ok, updated_state, tier, new_progress} = JackpotRules.play(state)

    if tier == 7 do
      # If it hit the jackpot (lucky chance!)
      assert new_progress == 14
      assert updated_state.bonustime.jackpot_progress == 0
    else
      # If it missed (consolation)
      assert new_progress == 1
      assert tier >= 1 and tier <= 6
      assert updated_state.bonustime.jackpot_progress == 1
    end
  end

  test "play/1 guarantees tier 7 jackpot and resets progress when starting at progress 13 (14th play)",
       %{state: state} do
    # Set progress to 13 (13 misses since last hit, so 14th attempt is guaranteed)
    state = put_in(state.bonustime.jackpot_progress, 13)

    # Play is guaranteed to hit
    {:ok, updated_state, tier, new_progress} = JackpotRules.play(state)

    assert tier == 7
    assert new_progress == 14
    assert updated_state.bonustime.jackpot_progress == 0
  end

  test "play/1 rolls tier 7 and resets progress even before 14th play on lucky hits", %{
    state: state
  } do
    # Set progress to 3
    state = put_in(state.bonustime.jackpot_progress, 3)

    # Let's mock a roll that hits: since our play function uses :rand.uniform() which is random,
    # we can run it many times, or mock it.
    # But since we just want to prove that *if* it hits tier 7 it resets jackpot_progress to 0,
    # we can see this behavior. Let's do a loop until it hits.
    # (Since base chance is ~0.5% + progress * 0.5% = 2.0% at progress 3, it will take ~50 rolls on average)
    {hit_state, hit_tier} =
      Enum.reduce_while(1..1000, state, fn _, acc_state ->
        case JackpotRules.play(acc_state) do
          {:ok, new_s, 7, _} -> {:halt, {new_s, 7}}
          {:ok, _new_s, _, _} -> {:cont, acc_state}
        end
      end)

    # We eventually got a jackpot
    assert hit_tier == 7
    assert hit_state.bonustime.jackpot_progress == 0
  end
end
