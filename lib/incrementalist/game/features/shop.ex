defmodule Incrementalist.Game.Features.Shop do
  @moduledoc """
  Authoritative logic for purchasing game features.
  """

  alias Incrementalist.Game.Constants

  def purchase(state, item_id) do
    with {:ok, item} <- fetch_item(item_id),
         :ok <- check_not_purchased(state, item_id),
         :ok <- check_level_requirement(state, item),
         {:ok, next_state} <- deduct_cost(state, item) do
      {:ok, apply_purchase_effects(next_state, item)}
    end
  end

  defp fetch_item(item_id) do
    item = Enum.find(Constants.shop_item_defs(), fn item -> item.id == item_id end)

    if item do
      {:ok, item}
    else
      {:error, "unknown_item"}
    end
  end

  defp check_not_purchased(state, item_id) do
    is_purchased =
      case item_id do
        "idle_mode" -> state.features.idle_mode_purchased
        "sisu_generator" -> state.features.sisu_generator_purchased
        "bonus_time" -> state.features.bonus_time_purchased
        _ -> false
      end

    if is_purchased do
      {:error, "already_purchased"}
    else
      :ok
    end
  end

  defp check_level_requirement(state, item) do
    if state.level >= item.required_level do
      :ok
    else
      {:error, "insufficient_level"}
    end
  end

  defp deduct_cost(state, item) do
    currency_key = item.currency
    balance = Map.get(state, currency_key)

    if BigNum.compare(balance, item.cost) >= 0 do
      new_balance = BigNum.sub(balance, item.cost)
      {:ok, Map.put(state, currency_key, new_balance)}
    else
      {:error, "insufficient_#{currency_key}"}
    end
  end

  defp apply_purchase_effects(state, item) do
    features = state.features

    features =
      case item.id do
        "idle_mode" -> %{features | idle_mode_purchased: true, world_map_unlocked: true}
        "sisu_generator" -> %{features | sisu_generator_purchased: true}
        "bonus_time" -> %{features | bonus_time_purchased: true}
        _ -> features
      end

    %{state | features: features}
  end
end
