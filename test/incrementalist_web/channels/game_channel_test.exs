defmodule IncrementalistWeb.GameChannelTest do
  use Incrementalist.DataCase, async: false
  import Phoenix.ChannelTest

  alias Incrementalist.Game.Push.GlobalTicker
  alias Incrementalist.Game.Sessions
  alias IncrementalistWeb.{GameChannel, UserSocket}

  @endpoint IncrementalistWeb.Endpoint
  @now ~U[2026-05-27 10:31:00.000000Z]

  test "forwards global.tick payloads to joined clients" do
    player = Sessions.authenticate_player(nil, @now)

    token = Phoenix.Token.sign(IncrementalistWeb.Endpoint, "player_auth", player.id)

    {:ok, socket} =
      connect(UserSocket, %{"token" => token, "cache_username" => player.username})

    {:ok, _boot, _channel_socket} = subscribe_and_join(socket, GameChannel, "game", %{})

    payload = GlobalTicker.global_tick_payload(@now)

    Phoenix.PubSub.broadcast(Incrementalist.PubSub, GlobalTicker.topic(), {:global_tick, payload})

    assert_push "global.tick", ^payload
  end
end
