defmodule Incrementalist.Game.Features.BonusTime.Games.Checklist do
  @moduledoc """
  Rules for Checklist games (Resource and Item checklists).
  """
  alias Incrementalist.Game.State

  # Authoritative checklist tier progression (17 entries)
  @tiers [2, 2, 3, 3, 3, 4, 4, 5, 3, 3, 4, 5, 6, 4, 4, 4, 7]

  @doc """
  Consumes a token and checks off the current entry in the given checklist.
  Returns {:ok, next_state, tier, current_index}.
  """
  def check_off(%State{} = state, checklist_key) when checklist_key in ["resource", "item"] do
    indexes = state.bonustime.checklist_entry_indexes || %{"resource" => 0, "item" => 0}
    current_index = Map.get(indexes, checklist_key, 0)

    # Get reward tier for current entry index (modulo 17)
    tier = Enum.at(@tiers, rem(current_index, 17), 1)

    # Advance entry index (modulo 17)
    next_index = rem(current_index + 1, 17)

    new_indexes = Map.put(indexes, checklist_key, next_index)
    new_bonustime = %{state.bonustime | checklist_entry_indexes: new_indexes}
    new_state = %{state | bonustime: new_bonustime}

    {:ok, new_state, tier, current_index}
  end
end
