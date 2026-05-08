defmodule Incrementalist.Game.Constants do
  @moduledoc """
  Centralizes magic numbers and domain limits.
  """

  def max_save_slots, do: 4
  def valid_slot_indexes, do: 0..(max_save_slots() - 1)

  def max_queued_commands, do: 10
  def valid_command_ids, do: 0..(max_queued_commands() - 1)
  def area_defs do
    [
      %{
        key: "sage",
        name: "The Sage",
        description: "A quiet, ancient place of wisdom where growth begins.",
        unlock_level: 1
      },
      %{
        key: "cloverfield",
        name: "Cloverfield",
        description: "A lush field where luck intertwines with every step.",
        unlock_level: 10
      },
      %{
        key: "market",
        name: "The Market",
        description: "A bustling market to trade your hard earned goods.",
        unlock_level: 15
      }
    ]
  end
end
