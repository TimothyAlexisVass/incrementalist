defmodule Incrementalist.Game.Persistence.CommandLogTest do
  use Incrementalist.DataCase, async: false

  alias Incrementalist.Game.Persistence.CommandLog
  alias Incrementalist.Game.Persistence.GameCommand
  alias Incrementalist.Game.Persistence.Player
  alias Incrementalist.Game.Sessions
  alias Incrementalist.Repo

  @now ~U[2026-05-04 12:00:00.000000Z]

  defp create_player do
    player = Sessions.authenticate_player(nil, @now)
    _snapshot = Sessions.boot_player(player.id, false, @now)
    Repo.get!(Player, player.id)
  end

  defp create_command(player_id, command_id, sequence, status, queued_at, acked_at \\ nil) do
    %GameCommand{}
    |> GameCommand.changeset(%{
      player_id: player_id,
      command_id: command_id,
      sequence: sequence,
      command_type: "game.noop",
      intent: %{"command_id" => command_id},
      status: status,
      queued_at: queued_at,
      acked_at: acked_at
    })
    |> Repo.insert!()
  end

  test "cleanup_acked/1 deletes only ACKed command rows older than 48 hours" do
    player = create_player()

    old_time = DateTime.add(@now, -49 * 60 * 60, :second)
    recent_time = DateTime.add(@now, -47 * 60 * 60, :second)

    # Old acked command (should be deleted)
    old_acked = create_command(player.id, 0, 1, "acked", old_time, old_time)

    # Old unacked command (should NOT be deleted)
    old_unacked = create_command(player.id, 1, 2, "queued", old_time)

    # Recent acked command (should NOT be deleted)
    recent_acked = create_command(player.id, 2, 3, "acked", recent_time, recent_time)

    # Recent unacked command (should NOT be deleted)
    recent_unacked = create_command(player.id, 3, 4, "queued", recent_time)

    assert CommandLog.cleanup_acked(@now) == 1

    refute Repo.get(GameCommand, old_acked.id)
    assert Repo.get(GameCommand, old_unacked.id)
    assert Repo.get(GameCommand, recent_acked.id)
    assert Repo.get(GameCommand, recent_unacked.id)
  end
end
