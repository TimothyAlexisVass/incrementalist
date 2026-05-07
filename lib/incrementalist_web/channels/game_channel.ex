defmodule IncrementalistWeb.GameChannel do
  @moduledoc """
  Command/result transport for gameplay.

  The Phoenix event name is the command type and the payload is visible intent
  plus the client-generated integer command id for that command. Player identity
  comes from the socket, while FIFO ordering and replay state stay in
  persistence.

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
      Sessions.boot_player(socket.assigns.player_id, socket.assigns.cached_save_slots)
      |> Map.put("pending_result", Commands.replay_pending(socket.assigns.player_id))

    {:ok, boot, socket}
  end

  @impl true
  def handle_in("command.ack", command_id, socket) do
    # ACK payload is intentionally just the client command id whose result was
    # applied. The server still refuses to advance unless that id is current.
    reply_command(Commands.ack(socket.assigns.player_id, command_id), socket)
  end

  def handle_in(command_type, payload, socket) when is_binary(command_type) do
    # Arbitrary event names are treated as command types; game-rule validation
    # happens inside the command executor.
    reply_command(Commands.enqueue(socket.assigns.player_id, command_type, payload), socket)
  end

  defp reply_command(:queue_full, socket), do: {:reply, {:error, %{}}, socket}
  defp reply_command(:invalid_command_id, socket), do: {:reply, {:error, %{}}, socket}
  defp reply_command(result, socket), do: {:reply, {:ok, result}, socket}
end
