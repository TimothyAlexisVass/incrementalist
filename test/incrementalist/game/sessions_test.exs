defmodule Incrementalist.Game.SessionsTest do
  use Incrementalist.DataCase, async: false

  alias Incrementalist.Game.Persistence.Player
  alias Incrementalist.Game.Sessions
  alias Incrementalist.Repo

  @now ~U[2026-05-04 12:00:00.000000Z]

  test "authenticate_player creates a player with a generated username and four slots" do
    player = Sessions.authenticate_player(nil, @now)

    assert player.username
    assert player.email == nil
    assert player.last_seen_at == @now

    boot = Sessions.boot_player(player.id, MapSet.new(), @now)

    assert boot["username"] == player.username
    assert boot["snapshot"]["active_save_slot"] == 0
    assert boot["snapshot"]["save_slot"]["has_data"]
  end

  test "authenticate_player refreshes an existing player by id" do
    player = Sessions.authenticate_player(nil, @now)
    later = DateTime.add(@now, 15, :minute)

    refreshed = Sessions.authenticate_player(player.id, later)

    assert refreshed.id == player.id
    assert refreshed.username == player.username
    assert refreshed.last_seen_at == later
  end

  test "cleanup_anonymous_players removes stale anonymous players only" do
    old = DateTime.add(@now, -95 * 24 * 60 * 60, :second)

    anonymous =
      %Player{}
      |> Player.changeset(%{
        username: "OldAnon",
        email: nil,
        active_save_slot: 0,
        last_seen_at: old
      })
      |> Repo.insert!()

    emailed =
      %Player{}
      |> Player.changeset(%{
        username: "KeptPlayer",
        email: "kept@example.com",
        active_save_slot: 0,
        last_seen_at: old
      })
      |> Repo.insert!()

    assert Sessions.cleanup_anonymous_players(@now) == 1
    refute Repo.get(Player, anonymous.id)
    assert Repo.get(Player, emailed.id)
  end
end
