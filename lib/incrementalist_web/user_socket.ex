defmodule IncrementalistWeb.UserSocket do
  @moduledoc """
  Authenticates socket connections with the server-issued username.

  Socket assigns hold the server-resolved player id. Channel messages therefore
  do not need, and must not accept, player ids from the browser.
  """

  use Phoenix.Socket

  alias Incrementalist.Game.Sessions
  alias Incrementalist.Game.Session.FullSnapshotOverrides

  channel "game", IncrementalistWeb.GameChannel

  @impl true
  def connect(params, socket, _connect_info) do
    player_id =
      case Map.get(params, "token") do
        token when is_binary(token) ->
          case Phoenix.Token.verify(socket.endpoint, "player_auth", token, max_age: 86400 * 365) do
            {:ok, id} -> id
            _ -> nil
          end

        _ ->
          nil
      end

    player = Sessions.authenticate_player(player_id)

    force_full_snapshot = FullSnapshotOverrides.consume?(player.id)

    has_cached_snapshot =
      case {Map.get(params, "has_cached_snapshot"), Map.get(params, "cache_username")} do
        {"true", cache_username} when is_binary(cache_username) and not force_full_snapshot ->
          cache_username == player.username

        _ ->
          false
      end

    {:ok,
     socket
     |> assign(:player_id, player.id)
     |> assign(:has_cached_snapshot, has_cached_snapshot)}
  end

  @impl true
  def id(socket), do: "player:#{socket.assigns.player_id}"
end
