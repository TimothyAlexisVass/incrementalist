defmodule Incrementalist.Game.Snapshots do
  alias Incrementalist.Game.{State, Time}

  def full(save_slot, active_slot_index, now \\ Time.now()) do
    %{
      "type" => "game.snapshot",
      "server_time" => Time.iso8601(now),
      "active_save_slot" => active_slot_index,
      "state_version" => save_slot.state_version,
      "state" => State.visible_state(save_slot.state),
      "save_slot" => State.summary(save_slot, active_slot_index)
    }
  end
end
