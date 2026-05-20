defmodule Incrementalist.Game.Features.ShopTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.Shop
  alias Incrementalist.Game.State

  setup do
    state = State.new()
    {:ok, state: state}
  end

  test "purchase/2 fails for unknown item", %{state: state} do
    assert {:error, "unknown_item"} = Shop.purchase(state, "unknown")
  end

  test "purchase/2 fails if already purchased", %{state: state} do
    # Level requirements for idle_mode is 2, and costs 500 coins.
    state = %{
      state
      | level: 2,
        coins: BigNum.from_number(500),
        features: %{state.features | idle_mode_purchased: true}
    }

    assert {:error, "already_purchased"} = Shop.purchase(state, "idle_mode")
  end

  test "purchase/2 fails if level is insufficient", %{state: state} do
    state = %{state | level: 1, coins: BigNum.from_number(500)}
    assert {:error, "insufficient_level"} = Shop.purchase(state, "idle_mode")
  end

  test "purchase/2 fails if balance is insufficient", %{state: state} do
    state = %{state | level: 2, coins: BigNum.from_number(499)}
    assert {:error, "insufficient_coins"} = Shop.purchase(state, "idle_mode")
  end

  test "purchase/2 deducts cost and applies effects for idle_mode", %{state: state} do
    state = %{state | level: 2, coins: BigNum.from_number(500)}
    assert {:ok, next_state} = Shop.purchase(state, "idle_mode")
    assert BigNum.zero() == next_state.coins
    assert next_state.features.idle_mode_purchased == true
    assert next_state.features.world_map_unlocked == true
  end

  test "purchase/2 deducts cost and applies effects for sisu_generator", %{state: state} do
    # Requires level 4, 2000 coins
    state = %{state | level: 4, coins: BigNum.from_number(2000)}
    assert {:ok, next_state} = Shop.purchase(state, "sisu_generator")
    assert BigNum.zero() == next_state.coins
    assert next_state.features.sisu_generator_purchased == true
  end

  test "purchase/2 deducts cost and applies effects for bonus_time", %{state: state} do
    # Requires level 15, 1000 shards
    state = %{state | level: 15, shards: BigNum.from_number(1000)}
    assert {:ok, next_state} = Shop.purchase(state, "bonus_time")
    assert BigNum.zero() == next_state.shards
    assert next_state.features.bonus_time_purchased == true
  end
end
