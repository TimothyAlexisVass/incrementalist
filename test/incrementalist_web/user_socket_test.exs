defmodule IncrementalistWeb.UserSocketTest do
  use Incrementalist.DataCase, async: false

  alias Incrementalist.Game.Sessions
  alias IncrementalistWeb.UserSocket

  @now ~U[2026-05-13 12:00:00.000000Z]

  test "connect authenticates a player and assigns player_id" do
    player = Sessions.authenticate_player(nil, @now)
    token = Phoenix.Token.sign(IncrementalistWeb.Endpoint, "player_auth", player.id)

    params = %{
      "token" => token,
      "cache_username" => player.username
    }

    socket = %Phoenix.Socket{endpoint: IncrementalistWeb.Endpoint}
    assert {:ok, connected_socket} = UserSocket.connect(params, socket, nil)

    assert connected_socket.assigns.player_id == player.id
    refute connected_socket.assigns.has_cached_snapshot
  end

  test "connect accepts has_cached_snapshot when cache_username matches" do
    player = Sessions.authenticate_player(nil, @now)
    token = Phoenix.Token.sign(IncrementalistWeb.Endpoint, "player_auth", player.id)

    params = %{
      "token" => token,
      "has_cached_snapshot" => "true",
      "cache_username" => player.username
    }

    socket = %Phoenix.Socket{endpoint: IncrementalistWeb.Endpoint}
    assert {:ok, connected_socket} = UserSocket.connect(params, socket, nil)

    assert connected_socket.assigns.player_id == player.id
    assert connected_socket.assigns.has_cached_snapshot == true
  end

  test "connect ignores has_cached_snapshot when cache_username does not match" do
    player = Sessions.authenticate_player(nil, @now)
    token = Phoenix.Token.sign(IncrementalistWeb.Endpoint, "player_auth", player.id)

    params = %{
      "token" => token,
      "has_cached_snapshot" => "true",
      "cache_username" => "DifferentPlayer"
    }

    socket = %Phoenix.Socket{endpoint: IncrementalistWeb.Endpoint}
    assert {:ok, connected_socket} = UserSocket.connect(params, socket, nil)

    assert connected_socket.assigns.player_id == player.id
    assert connected_socket.assigns.has_cached_snapshot == false
  end
end
