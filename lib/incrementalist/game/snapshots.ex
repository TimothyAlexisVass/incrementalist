defmodule Incrementalist.Game.Snapshots do
  @moduledoc """
  Full authoritative payloads used when the client needs a complete visible
  replacement for its current server snapshot.

  Command results can be smaller than this; snapshots are for boot, reconnect,
  and game resets where partial state would leave stale client projection.
  """

  alias Incrementalist.Game.{Notices, State, Time}

  def full(player_state, now \\ Time.now()) do
    %{
      "type" => "game.snapshot",
      "server_time" => Time.iso8601(now),
      "state" => State.visible_state(player_state.state, now),
      "notices" => Notices.payload(player_state.notices || Notices.new(player_state.state))
    }
  end
end
