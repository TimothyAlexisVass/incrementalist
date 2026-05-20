defmodule Incrementalist.Game.Features.BonusTime.Games.Checklist do
  @moduledoc """
  Rules for Checklist games (Resource and Item checklists).
  """
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.State

  @doc """
  Consumes a token and checks off the current entry in the given checklist.
  Returns {:ok, next_state, tier, current_index}.
  """
  def check_off(%State{} = state, checklist_key) when checklist_key in ["resource", "item"] do
    tiers = Constants.bonustime_checklist_entries()
    entry_count = max(1, length(tiers))
    indexes = state.bonustime.checklist_entry_indexes || %{"resource" => 0, "item" => 0}
    current_index = normalize_checklist_index(Map.get(indexes, checklist_key, 0), entry_count)

    tier = Enum.at(tiers, current_index, 1)

    next_index = rem(current_index + 1, entry_count)

    new_indexes = Map.put(indexes, checklist_key, next_index)
    new_bonustime = %{state.bonustime | checklist_entry_indexes: new_indexes}
    new_state = %{state | bonustime: new_bonustime}

    {:ok, new_state, tier, current_index}
  end

  defp normalize_checklist_index(value, entry_count)
       when is_integer(value) and value >= 0 and value < entry_count do
    value
  end

  defp normalize_checklist_index(_value, _entry_count), do: 0
end
