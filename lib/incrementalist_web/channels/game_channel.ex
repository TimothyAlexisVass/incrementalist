defmodule IncrementalistWeb.GameChannel do
  use Phoenix.Channel

  alias Incrementalist.Game.{Commands, Sessions}

  @impl true
  def join("game", _params, socket) do
    boot =
      socket.assigns.player_id
      |> Sessions.boot_player(socket.assigns.anonymous_player_token)
      |> Map.put("pending_result", Commands.replay_pending(socket.assigns.player_id))

    {:ok, boot, socket}
  end

  @impl true
  def handle_in("command.ack", _payload, socket) do
    {:reply, {:ok, Commands.ack(socket.assigns.player_id)}, socket}
  end

  def handle_in(command_type, payload, socket) when is_binary(command_type) do
    {:reply, {:ok, Commands.enqueue(socket.assigns.player_id, command_type, payload)}, socket}
  end
end
