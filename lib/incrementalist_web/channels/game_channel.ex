defmodule IncrementalistWeb.GameChannel do
  @moduledoc """
  Command/result transport for gameplay.

  The Phoenix event name is the command type and the payload is visible intent
  plus the client-generated integer command id for that command. Player identity
  comes from the socket, while FIFO ordering and replay state stay in the
  player's GenServer session.

  Phoenix refs only correlate websocket replies with browser promises. They are
  not gameplay command ids and are never stored.
  """

  use Phoenix.Channel

  alias Incrementalist.Game.Push.GlobalTicker
  alias Incrementalist.Game.Sessions
  alias Incrementalist.Game.Session.PlayerServer

  @impl true
  def join("game", _params, socket) do
    :ok = Phoenix.PubSub.subscribe(Incrementalist.PubSub, GlobalTicker.topic())

    :ok =
      Phoenix.PubSub.subscribe(
        Incrementalist.PubSub,
        PlayerServer.player_push_topic(socket.assigns.player_id)
      )

    :ok = PlayerServer.connect_channel(socket.assigns.player_id, self())
    boot = Sessions.boot_player(socket.assigns.player_id, socket.assigns.has_cached_snapshot)

    token = Phoenix.Token.sign(socket.endpoint, "player_auth", socket.assigns.player_id)
    boot = Map.put(boot, "token", token)

    {:ok, boot, socket}
  end

  @impl true
  def terminate(_reason, socket) do
    PlayerServer.disconnect_channel(socket.assigns.player_id, self())
    :ok
  end

  @impl true
  def handle_in("command.ack", command_id, socket) do
    reply_command(PlayerServer.ack(socket.assigns.player_id, command_id), socket)
  end

  def handle_in(command_type, payload, socket) when is_binary(command_type) do
    reply_command(PlayerServer.enqueue(socket.assigns.player_id, command_type, payload), socket)
  end

  @impl true
  def handle_info({:global_tick, payload}, socket) when is_map(payload) do
    push(socket, "global.tick", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info({:player_projection_tick, payload}, socket) when is_map(payload) do
    push(socket, "player.projection.tick", payload)
    {:noreply, socket}
  end

  defp reply_command(:queue_full, socket), do: {:reply, {:error, %{}}, socket}
  defp reply_command(:invalid_command_id, socket), do: {:reply, {:error, %{}}, socket}
  defp reply_command(result, socket), do: {:reply, {:ok, result}, socket}
end
