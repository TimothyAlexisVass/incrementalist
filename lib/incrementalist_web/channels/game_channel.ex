defmodule IncrementalistWeb.GameChannel do
  @moduledoc """
  Command/result transport for gameplay.

  The Phoenix event name is the command type and the payload is visible intent
  for that command. There is no generic client envelope: player identity comes
  from the socket, command ids and ordering come from persistence, and each push
  receives exactly one server result.

  Phoenix refs only correlate websocket replies with browser promises. They are
  not gameplay command ids and are never stored.
  """

  use Phoenix.Channel

  alias Incrementalist.Game.{Commands, Sessions}

  @impl true
  def join("game", _params, socket) do
    # Boot may omit the snapshot when the browser already has a cached visible
    # copy for the active slot. Pending command replay still comes from storage.
    boot =
      Sessions.boot_player(
        socket.assigns.player_id,
        socket.assigns.anonymous_player_token,
        socket.assigns.cached_save_slots
      )
      |> Map.put("pending_result", Commands.replay_pending(socket.assigns.player_id))

    {:ok, boot, socket}
  end

  @impl true
  def handle_in("command.ack", _payload, socket) do
    # The payload is ignored on purpose: the server acknowledges the current
    # blocking result for this player and may release the next queued command.
    {:reply, {:ok, Commands.ack(socket.assigns.player_id)}, socket}
  end

  def handle_in(command_type, payload, socket) when is_binary(command_type) do
    # Arbitrary event names are treated as command types; validation and rejection
    # happen inside the command executor so every command-shaped push gets a result.
    {:reply, {:ok, Commands.enqueue(socket.assigns.player_id, command_type, payload)}, socket}
  end
end
