defmodule IncrementalistWeb.GameChannelTest do
  use Incrementalist.DataCase, async: false
  import Phoenix.ChannelTest

  alias Incrementalist.Game.Sessions
  alias IncrementalistWeb.{GameChannel, UserSocket}

  @endpoint IncrementalistWeb.Endpoint
  @now ~U[2026-05-27 10:31:00.000000Z]

  test "forwards player.tick payloads to joined clients" do
    player = Sessions.authenticate_player(nil, @now)

    token = Phoenix.Token.sign(IncrementalistWeb.Endpoint, "player_auth", player.id)

    {:ok, socket} =
      connect(UserSocket, %{"token" => token, "cache_username" => player.username})

    {:ok, _boot, _channel_socket} = subscribe_and_join(socket, GameChannel, "game", %{})

    payload = %{
      "type" => "player.tick",
      "server_time" => DateTime.to_iso8601(@now),
      "climate" => %{
        "epoch_at" => DateTime.to_iso8601(@now),
        "year" => 1008,
        "day_in_year" => 1,
        "temperature_c" => 18,
        "rain_mm" => 0.0
      },
      "soil" => %{
        "water" => 0,
        "water_cap" => 100,
        "nitrogen" => %{"m" => 1.0, "e" => 0},
        "phosphorus" => %{"m" => 1.0, "e" => 0},
        "potassium" => %{"m" => 1.0, "e" => 0},
        "organic_matter" => %{"m" => 1.0, "e" => 0},
        "organic_matter_cap" => 1000.0
      },
      "has_bonustime_token" => true
    }

    Phoenix.PubSub.broadcast(
      Incrementalist.PubSub,
      "game:player:#{player.id}",
      {:player_tick, payload}
    )

    assert_push "player.tick", ^payload
  end
end
