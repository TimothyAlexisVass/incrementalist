defmodule Incrementalist.Game.Constants do
  @moduledoc """
  Centralizes magic numbers and domain limits.
  """

  def max_save_slots, do: 4
  def valid_slot_indexes, do: 0..(max_save_slots() - 1)

  def max_queued_commands, do: 10
  def valid_command_ids, do: 0..(max_queued_commands() - 1)
end
