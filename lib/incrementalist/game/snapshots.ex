defmodule Incrementalist.Game.Snapshots do
  @moduledoc """
  Full authoritative payloads used when the client needs a complete visible
  replacement for its current server snapshot.

  Command results can be smaller than this; snapshots are for boot, reconnect,
  and save-slot loads where partial state would leave stale client projection.
  """

  alias Incrementalist.Game.{State, Time}

  def full(save_slot, active_slot_index, now \\ Time.now()) do
    %{
      "type" => "game.snapshot",
      "server_time" => Time.iso8601(now),
      "active_save_slot" => active_slot_index,
      "state" => State.visible_state(save_slot.state, now),
      "notices" => save_slot.notices,
      "save_slot" => State.summary(save_slot, active_slot_index)
    }
  end
end
