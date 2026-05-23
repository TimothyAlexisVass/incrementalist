defmodule Incrementalist.Game.Features.Areas do
  @moduledoc """
  Handles area selection and validation.
  """
  alias Incrementalist.Game.{State, Constants}

  def select_area(%State{} = state, area_key) do
    case find_visible_area_def(state, area_key) do
      nil ->
        {:error, :unknown_area}

      area_def ->
        if area_unlocked?(state, area_def) do
          {:ok, %{state | area: area_key}}
        else
          {:error, :area_locked}
        end
    end
  end

  def visible_area_defs(%State{} = state) do
    Constants.area_defs()
    |> Enum.filter(&area_visible?(state, &1.key))
    |> Enum.map(fn area_def ->
      dynamic_lock_reason = area_dynamic_lock_reason(state, area_def)

      area_def
      |> Map.put(:is_locked, !area_unlocked?(state, area_def))
      |> maybe_put_lock_reason(dynamic_lock_reason)
    end)
  end

  def ensure_valid_current_area(%State{} = state, fallback_area_key \\ "sage") do
    current_area_key = state.area || fallback_area_key

    if area_selectable?(state, current_area_key) do
      state
    else
      %{state | area: fallback_visible_area(state, fallback_area_key)}
    end
  end

  defp find_visible_area_def(state, key) do
    Enum.find(visible_area_defs(state), fn def -> def.key == key end)
  end

  defp area_selectable?(state, area_key) do
    case find_visible_area_def(state, area_key) do
      nil -> false
      area_def -> area_unlocked?(state, area_def)
    end
  end

  defp fallback_visible_area(state, fallback_area_key) do
    area_defs = visible_area_defs(state)

    cond do
      area_selectable?(state, fallback_area_key) ->
        fallback_area_key

      selectable = Enum.find(area_defs, &area_unlocked?(state, &1)) ->
        selectable.key

      first_visible = List.first(area_defs) ->
        first_visible.key

      true ->
        fallback_area_key
    end
  end

  defp area_visible?(%State{} = state, "cloverfield") do
    clover_hunt = state.clover_hunt || %State.CloverHunt{}
    clover_hunt.six_leaf_confirmed != true
  end

  defp area_visible?(_state, _area_key), do: true

  defp area_unlocked?(%State{} = state, area_def) do
    level_unlocked?(state, area_def) and is_nil(area_dynamic_lock_reason(state, area_def))
  end

  defp level_unlocked?(%State{} = state, area_def) do
    (state.level || 1) >= area_def.unlock_level
  end

  defp area_dynamic_lock_reason(%State{} = state, %{key: "cloverfield"}) do
    clover_hunt = state.clover_hunt || %State.CloverHunt{}
    claimed_rank = clover_hunt_claimed_rank(state)

    cond do
      (clover_hunt.five_leaf_found_count || 0) >= 1 and claimed_rank < 2 ->
        "Claim the Quest first!"

      (clover_hunt.four_leaf_found_count || 0) >= 1 and claimed_rank < 1 ->
        "Claim the Quest first!"

      true ->
        nil
    end
  end

  defp area_dynamic_lock_reason(_state, _area_def), do: nil

  defp maybe_put_lock_reason(area_def, nil), do: Map.delete(area_def, :lock_reason)

  defp maybe_put_lock_reason(area_def, lock_reason),
    do: Map.put(area_def, :lock_reason, lock_reason)

  defp clover_hunt_claimed_rank(%State{} = state) do
    case Enum.find(state.quests || [], fn quest -> quest.id == "clover_hunt" end) do
      nil -> 0
      quest -> quest.claimed_rank || 0
    end
  end
end
