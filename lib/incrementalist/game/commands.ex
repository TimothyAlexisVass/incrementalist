defmodule Incrementalist.Game.Commands do
  @moduledoc """
  Thin facade over `PlayerServer` command APIs.

  Live command sequencing, execution, replay, and ACK gating are owned by the
  per-player GenServer.
  """

  alias Incrementalist.Game.Session.PlayerServer
  alias Incrementalist.Game.Time

  def enqueue(player_id, session_id, command_type, intent \\ %{}, now \\ Time.now()) do
    PlayerServer.enqueue(player_id, session_id, command_type, intent, now)
  end

  def ack(player_id, session_id, command_id, now \\ Time.now()) do
    PlayerServer.ack(player_id, session_id, command_id, now)
  end

  def replay_pending(player_id, last_known_sequence \\ nil) do
    PlayerServer.replay_pending(player_id, last_known_sequence)
  end
end
