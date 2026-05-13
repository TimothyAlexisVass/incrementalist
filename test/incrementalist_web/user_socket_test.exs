defmodule IncrementalistWeb.UserSocketTest do
  use Incrementalist.DataCase, async: false

  alias Incrementalist.Game.Sessions
  alias IncrementalistWeb.UserSocket

  @now ~U[2026-05-13 12:00:00.000000Z]

  test "ignores cached save slots when cache_username does not match authenticated player username" do
    player = Sessions.authenticate_player(nil, @now)
    token = Phoenix.Token.sign(IncrementalistWeb.Endpoint, "player_auth", player.id)

    params = %{
      "token" => token,
      "cached_save_slots" => "0,1,2,3",
      "cache_username" => "DifferentPlayer"
    }

    socket = %Phoenix.Socket{endpoint: IncrementalistWeb.Endpoint}
    assert {:ok, connected_socket} = UserSocket.connect(params, socket, nil)

    assert connected_socket.assigns.player_id == player.id
    assert connected_socket.assigns.cached_save_slots == MapSet.new()
  end

  test "accepts cached save slots when cache_username matches authenticated player username" do
    player = Sessions.authenticate_player(nil, @now)
    token = Phoenix.Token.sign(IncrementalistWeb.Endpoint, "player_auth", player.id)

    params = %{
      "token" => token,
      "cached_save_slots" => "0,2,99,invalid",
      "cache_username" => player.username
    }

    socket = %Phoenix.Socket{endpoint: IncrementalistWeb.Endpoint}
    assert {:ok, connected_socket} = UserSocket.connect(params, socket, nil)

    assert connected_socket.assigns.player_id == player.id
    assert connected_socket.assigns.cached_save_slots == MapSet.new([0, 2])
  end
end
