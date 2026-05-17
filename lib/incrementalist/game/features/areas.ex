defmodule Incrementalist.Game.Features.Areas do
  @moduledoc """
  Handles area selection and validation.
  """
  alias Incrementalist.Game.{State, Constants}

  @area_defs Map.new(Constants.area_defs(), &{&1.key, &1})

  def select_area(%State{} = state, area_key) do
    case find_area_def(area_key) do
      nil ->
        {:error, :unknown_area}

      area_def ->
        if (state.level || 1) >= area_def.unlock_level do
          {:ok, %{state | area: area_key}}
        else
          {:error, :area_locked}
        end
    end
  end

  defp find_area_def(key) do
    Map.get(@area_defs, key)
  end
end
