defmodule IncrementalistWeb.DebugControllerTest do
  use IncrementalistWeb.ConnCase

  import Ecto.Query
  alias Incrementalist.Game.Persistence.{Player, PlayerState, GameCommand}
  alias Incrementalist.Game.Persistence.PlayerStates
  alias Incrementalist.Game.Session.FullSnapshotOverrides
  alias Incrementalist.Repo

  defp create_player(username) do
    %Player{}
    |> Player.changeset(%{
      username: username,
      last_seen_at: DateTime.utc_now()
    })
    |> Repo.insert!()
  end

  setup do
    FullSnapshotOverrides.clear()
    Application.delete_env(:incrementalist, :bonustime_game_override)
    Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)

    on_exit(fn ->
      Application.delete_env(:incrementalist, :bonustime_game_override)
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
    end)

    :ok
  end

  test "GET /debug - lists empty players and registered players", %{conn: conn} do
    # 1. Initially empty
    conn1 = get(conn, "/debug")
    assert html_response(conn1, 200) =~ "No players found in database"

    # 2. After inserting a player
    _player = create_player("tester_bob")
    conn2 = get(conn, "/debug")
    assert html_response(conn2, 200) =~ "tester_bob"
    assert html_response(conn2, 200) =~ "No State"
  end

  test "GET /debug/edit/:id - loads or initializes save state", %{conn: conn} do
    player = create_player("tester_alice")

    # This should automatically create the default PlayerState row and display its JSON
    conn = get(conn, "/debug/edit/#{player.id}")
    resp = html_response(conn, 200)
    assert resp =~ "tester_alice"
    assert resp =~ "\"level\":"
  end

  test "POST /debug/update/:id - updates state correctly with valid JSON", %{conn: conn} do
    player = create_player("tester_charlie")
    _ps = PlayerStates.load_or_create(player)

    # Let's set some custom levels and coins in the json state!
    custom_state = %{
      "level" => 42,
      "coins" => %{"m" => 5.5, "e" => 2}
    }

    json_payload = Jason.encode!(custom_state)

    conn = post(conn, "/debug/update/#{player.id}", %{"state_json" => json_payload})
    assert redirected_to(conn) =~ "/debug?success="

    # Verify database state was updated authoritative-ly
    updated_ps = PlayerStates.get(player.id)
    assert updated_ps.state.level == 42
    assert updated_ps.state.coins.m == 5.5
    assert updated_ps.state.coins.e == 2
  end

  test "POST /debug/update/:id - returns nice errors for invalid JSON", %{conn: conn} do
    player = create_player("tester_dave")

    conn = post(conn, "/debug/update/#{player.id}", %{"state_json" => "{invalid_json_here}"})
    resp = html_response(conn, 200)
    assert resp =~ "Invalid JSON Format"
  end

  test "POST /debug/delete/:id - performs cascading deletions of player, state, and command logs",
       %{conn: conn} do
    player = create_player("tester_eve")
    ps = PlayerStates.load_or_create(player)
    p_id = player.id

    # Create dummy command
    %GameCommand{}
    |> GameCommand.changeset(%{
      player_id: player.id,
      player_state_id: ps.id,
      command_id: 1,
      sequence: 1,
      command_type: "bonustime.play",
      intent: %{},
      status: "queued",
      queued_at: DateTime.utc_now()
    })
    |> Repo.insert!()

    # Verify existences
    assert Repo.get(Player, p_id)
    assert Repo.one(from gc in GameCommand, where: gc.player_id == ^p_id)

    # Delete
    conn = post(conn, "/debug/delete/#{p_id}")
    assert redirected_to(conn) =~ "/debug?success="

    # Verify wipped cascade
    refute Repo.get(Player, p_id)
    refute Repo.one(from ps in PlayerState, where: ps.player_id == ^p_id)
    refute Repo.one(from gc in GameCommand, where: gc.player_id == ^p_id)
  end

  test "POST /debug/set_active_game - sets and resets rotation anchor overrides", %{conn: conn} do
    # 1. Shift anchor so prize_wheel is active immediately
    conn = post(conn, "/debug/set_active_game", %{"game_id" => "prize_wheel"})
    assert redirected_to(conn) =~ "/debug?success="
    assert is_binary(Application.get_env(:incrementalist, :bonustime_rotation_anchor_override))
    assert Incrementalist.Game.Features.BonusTime.Rules.get_active_game_id() == "prize_wheel"
    assert is_nil(Application.get_env(:incrementalist, :bonustime_game_override))

    # 2. Reset back to natural rotation anchor
    conn2 = post(conn, "/debug/set_active_game", %{"game_id" => "rotation"})
    assert redirected_to(conn2) =~ "/debug?success="
    assert is_nil(Application.get_env(:incrementalist, :bonustime_rotation_anchor_override))
  end

  test "POST /debug/grant_token/:id - sets has_bonustime_token to true", %{conn: conn} do
    player = create_player("tester_token_grant")
    ps = PlayerStates.load_or_create(player)

    # Force has_bonustime_token to false first
    Repo.update!(PlayerState.changeset(ps, %{has_bonustime_token: false}))
    refute PlayerStates.get(player.id).has_bonustime_token

    # Grant token
    conn = post(conn, "/debug/grant_token/#{player.id}")
    assert redirected_to(conn) =~ "/debug?success="

    # Verify that token is now true
    assert PlayerStates.get(player.id).has_bonustime_token
  end

  test "POST /debug/full_snapshot/:id - queues one-shot full snapshot for player", %{conn: conn} do
    player = create_player("tester_full_snapshot")

    conn = post(conn, "/debug/full_snapshot/#{player.id}")
    assert redirected_to(conn) =~ "/debug?success="

    assert FullSnapshotOverrides.consume?(player.id)
    refute FullSnapshotOverrides.consume?(player.id)
  end
end
