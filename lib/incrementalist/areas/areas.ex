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
      Map.put(area_def, :is_locked, !area_unlocked?(state, area_def))
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
    clover_hunt_quest =
      Enum.find(state.quests || [], fn quest ->
        quest.id == "clover_hunt"
      end)

    (clover_hunt_quest && (clover_hunt_quest.claimed_rank || 0) >= 3) != true
  end

  defp area_visible?(_state, _area_key), do: true

  defp area_unlocked?(%State{} = state, area_def) do
    (state.level || 1) >= area_def.unlock_level
  end
end
