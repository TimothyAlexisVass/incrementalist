defmodule IncrementalistWeb.UserSocket do
  use Phoenix.Socket

  alias Incrementalist.Game.Sessions

  channel "game", IncrementalistWeb.GameChannel

  @impl true
  def connect(params, socket, _connect_info) do
    token = Map.get(params, "anonymous_player_token")
    session = Sessions.authenticate_anonymous(token)

    {:ok,
     socket
     |> assign(:player_id, session.player.id)
     |> assign(:anonymous_player_token, session.anonymous_player_token)}
  end

  @impl true
  def id(socket), do: "player:#{socket.assigns.player_id}"
end
