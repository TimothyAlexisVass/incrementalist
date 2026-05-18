defmodule Incrementalist.Game.CommandsTest do
  use Incrementalist.DataCase, async: false

  import Ecto.Query

  alias Incrementalist.Game.Commands
  alias Incrementalist.Game.Persistence.{CommandLog, GameCommand, Player, PlayerStates}
  alias Incrementalist.Game.Session.PlayerServer
  alias Incrementalist.Game.{Notices, Sessions}
  alias Incrementalist.Repo

  @now ~U[2026-05-04 12:00:00.000000Z]

  test "anonymous sessions create one player state and boot returns a snapshot" do
    player = Sessions.authenticate_player(nil, @now)

    ps = PlayerStates.get!(player.id)
    assert ps.player_id == player.id

    boot = Sessions.boot_player(player.id, false, @now)

    assert boot["username"] == player.username
    assert boot["snapshot"]["state"]
  end

  test "boot can omit a full snapshot when the client has a cached snapshot" do
    player = Sessions.authenticate_player(nil, @now)
    _initial_boot = Sessions.boot_player(player.id, false, @now)

    cached_boot = Sessions.boot_player(player.id, true, @now)

    assert cached_boot["snapshot"] == nil
  end

  test "commands are FIFO and ACK-gated" do
    player = create_player()

    first = Commands.enqueue(player.id, "game.noop", intent(0), @now)
    second = Commands.enqueue(player.id, "game.noop", intent(1), @now)
    third = Commands.enqueue(player.id, "game.noop", intent(2), @now)

    assert first["type"] == "game.noop.result"
    assert first["command_id"] == 0
    refute Map.has_key?(first, "requires_ack")
    assert second["type"] == "command.queued"
    assert second["command_id"] == 1
    refute Map.has_key?(second, "command_type")
    refute Map.has_key?(second, "queue_position")
    refute Map.has_key?(second, "requires_ack")
    assert third["type"] == "command.queued"
    assert command_statuses(player.id) == ["succeeded"]

    ack = Commands.ack(player.id, 0, @now)
    assert ack["command_id"] == 0
    refute Map.has_key?(ack, "acked")
    refute Map.has_key?(ack, "next_result")
    refute Map.has_key?(ack, "requires_ack")
    assert ack["released_result"]["type"] == "game.noop.result"
    assert ack["released_result"]["command_id"] == 1
    assert command_statuses(player.id) == ["acked", "succeeded"]

    ack = Commands.ack(player.id, 1, @now)
    assert ack["released_result"]["type"] == "game.noop.result"
    assert ack["released_result"]["command_id"] == 2
    assert command_statuses(player.id) == ["acked", "acked", "succeeded"]
  end

  test "ack ignores command ids that are not the current blocking result" do
    player = create_player()

    Commands.enqueue(player.id, "game.noop", intent(0), @now)
    Commands.enqueue(player.id, "game.noop", intent(1), @now)

    ignored = Commands.ack(player.id, 1, @now)

    assert ignored["command_id"] == 1
    assert ignored["released_result"] == nil
    assert command_statuses(player.id) == ["succeeded"]

    released = Commands.ack(player.id, 0, @now)

    assert released["released_result"]["type"] == "game.noop.result"
    assert released["released_result"]["command_id"] == 1
    assert command_statuses(player.id) == ["acked", "succeeded"]
  end

  test "area.select updates the current area when unlocked" do
    player = create_player()

    # Sage is unlocked by default
    result = Commands.enqueue(player.id, "area.select", intent(0, %{"area" => "sage"}), @now)
    assert result["type"] == "area.select.result"
    assert result["area"] == "sage"

    Commands.ack(player.id, 0, @now)

    # Cloverfield is locked at level 1
    locked =
      Commands.enqueue(player.id, "area.select", intent(1, %{"area" => "cloverfield"}), @now)

    assert locked["type"] == "command.error"
    assert locked["reason"] == "area_locked"
  end

  test "notice.event child_clicked clears an active sage tip leaf" do
    player = create_player()

    result =
      Commands.enqueue(
        player.id,
        "notice.event",
        intent(0, %{"event" => "child_clicked", "leaf_id" => "leaf.sage_tip.1.confirm_button"}),
        @now
      )

    assert result["type"] == "notice.event.result"
    assert result["leaf_id"] == "leaf.sage_tip.1.confirm_button"

    ps = PlayerStates.get!(player.id)
    refute "leaf.sage_tip.1.confirm_button" in ps.notices.active_leaf_ids
    assert "leaf.sage_tip.1.confirm_button" in ps.notices.dismissed_leaf_ids
  end

  test "notice.event child_shown for a sage tip keeps sage guidance cleared after area switch" do
    player = create_player()
    ps = PlayerStates.get!(player.id)
    unlocked_state = %{ps.state | level: 10, area: "sage"}

    other_tip_leaf_ids =
      Incrementalist.Game.Constants.sage_tip_levels()
      |> Enum.reject(&(&1 == 1))
      |> Enum.map(&Notices.leaf_sage_tip_id/1)

    notices =
      Notices.new(unlocked_state)
      |> then(fn seeded ->
        %{
          seeded
          | dismissed_leaf_ids: Enum.uniq(seeded.dismissed_leaf_ids ++ other_tip_leaf_ids),
            active_leaf_ids: Enum.reject(seeded.active_leaf_ids, &(&1 in other_tip_leaf_ids))
        }
      end)

    ps
    |> Incrementalist.Game.Persistence.PlayerState.changeset(%{
      state: unlocked_state,
      notices: notices,
      last_saved_at: @now
    })
    |> Repo.update!()

    shown_notice =
      Commands.enqueue(
        player.id,
        "notice.event",
        intent(0, %{"event" => "child_shown", "leaf_id" => "leaf.sage_tip.1.confirm_button"}),
        @now
      )

    assert shown_notice["type"] == "notice.event.result"
    Commands.ack(player.id, 0, @now)

    go_cloverfield =
      Commands.enqueue(player.id, "area.select", intent(1, %{"area" => "cloverfield"}), @now)

    assert go_cloverfield["type"] == "area.select.result"
    refute "leaf.area.sage.go_button" in go_cloverfield["notices"]["active_leaf_ids"]
    refute "parent.area.dropdown" in go_cloverfield["notices"]["active_parent_ids"]

    updated_ps = PlayerStates.get!(player.id)
    assert "leaf.sage_tip.1.confirm_button" in updated_ps.notices.seen_leaf_ids
    refute "leaf.sage_tip.1.confirm_button" in updated_ps.notices.dismissed_leaf_ids
    refute "leaf.area.sage.go_button" in updated_ps.notices.active_leaf_ids
  end

  test "dismissed non-sage area leaf notice stays cleared after area navigation" do
    player = create_player()
    ps = PlayerStates.get!(player.id)
    unlocked_state = %{ps.state | level: 10, area: "sage"}

    ps
    |> Incrementalist.Game.Persistence.PlayerState.changeset(%{
      state: unlocked_state,
      notices: Notices.new(unlocked_state),
      last_saved_at: @now
    })
    |> Repo.update!()

    click_notice =
      Commands.enqueue(
        player.id,
        "notice.event",
        intent(0, %{"event" => "child_clicked", "leaf_id" => "leaf.area.cloverfield.go_button"}),
        @now
      )

    assert click_notice["type"] == "notice.event.result"
    Commands.ack(player.id, 0, @now)

    go_cloverfield =
      Commands.enqueue(player.id, "area.select", intent(1, %{"area" => "cloverfield"}), @now)

    assert go_cloverfield["type"] == "area.select.result"
    Commands.ack(player.id, 1, @now)

    go_sage = Commands.enqueue(player.id, "area.select", intent(2, %{"area" => "sage"}), @now)

    assert go_sage["type"] == "area.select.result"

    updated_ps = PlayerStates.get!(player.id)
    refute "leaf.area.cloverfield.go_button" in updated_ps.notices.active_leaf_ids
    assert "leaf.area.cloverfield.go_button" in updated_ps.notices.dismissed_leaf_ids
  end

  test "stored results replay without re-executing command rules" do
    player = create_player()

    result = Commands.enqueue(player.id, "game.reset", intent(0), @now)
    replayed_once = Commands.replay_pending(player.id)
    replayed_twice = Commands.replay_pending(player.id)

    assert replayed_once == result
    assert replayed_twice == result
    assert result["command_id"] == 0
    assert Repo.aggregate(GameCommand, :count) == 1

    command = Repo.one!(GameCommand)
    assert command.replay_count == 2

    Commands.ack(player.id, 0, @now)
    assert Commands.replay_pending(player.id) == nil
  end

  test "the session replay buffer can replay the last completed command by sequence" do
    player = create_player()

    result = Commands.enqueue(player.id, "game.noop", intent(0), @now)

    Commands.ack(player.id, 0, @now)

    assert PlayerServer.replay_pending(player.id, 0) == result
  end

  test "command ids are limited to the ten client queue slots" do
    player = create_player()

    assert Commands.enqueue(player.id, "game.noop", intent(0), @now)["type"] == "game.noop.result"

    for command_id <- 1..9 do
      assert Commands.enqueue(player.id, "game.noop", intent(command_id), @now)["type"] ==
               "command.queued"
    end

    rejected = Commands.enqueue(player.id, "game.noop", intent(10), @now)

    assert rejected == :invalid_command_id
    assert Repo.aggregate(GameCommand, :count) == 1
  end

  test "game.reset resets the player state and returns a fresh snapshot" do
    player = create_player()

    reset_result = Commands.enqueue(player.id, "game.reset", intent(0), @now)
    assert reset_result["type"] == "game.reset.result"
    assert reset_result["snapshot"]["state"]
  end

  test "game.reset blocks follow-up commands until acknowledged" do
    player = create_player()

    Commands.enqueue(player.id, "game.noop", intent(0), @now)

    reset = Commands.enqueue(player.id, "game.reset", intent(1), @now)
    assert reset["type"] == "command.queued"
    assert Commands.enqueue(player.id, "game.noop", intent(2), @now) == :queue_full

    ack = Commands.ack(player.id, 0, @now)

    assert ack["released_result"]["type"] == "game.reset.result"
    assert ack["released_result"]["command_id"] == 1
    assert command_statuses(player.id) == ["acked", "succeeded"]

    ack = Commands.ack(player.id, 1, @now)

    assert ack["released_result"] == nil
    assert command_statuses(player.id) == ["acked", "acked"]
  end

  test "game.reset persists claim boundary from snapshot projection" do
    player = create_player()

    reset_result = Commands.enqueue(player.id, "game.reset", intent(0), @now)
    assert reset_result["type"] == "game.reset.result"

    can_claim_at =
      get_in(reset_result, ["snapshot", "state", "projection_params", "can_claim_at"])

    assert is_binary(can_claim_at)

    {:ok, claim_at, 0} = DateTime.from_iso8601(can_claim_at)

    Commands.ack(player.id, 0, @now)

    claim_result =
      Commands.enqueue(
        player.id,
        "progress.claim_reward",
        intent(1),
        claim_at
      )

    assert claim_result["type"] == "progress.claim_reward.result"
    assert claim_result["charge_crystals"].azure == 0
  end

  test "reconnect boot includes the unacked stored result" do
    player = Sessions.authenticate_player(nil, @now)

    result = Commands.enqueue(player.id, "game.noop", intent(0), @now)

    boot =
      player.id
      |> Sessions.boot_player(false, @now)
      |> Map.put("pending_result", Commands.replay_pending(player.id))

    assert boot["pending_result"] == result
  end

  test "bonustime.play keeps projected rotation fields in command result bonustime payload" do
    Application.put_env(
      :incrementalist,
      :bonustime_rotation_anchor_override,
      DateTime.to_iso8601(@now)
    )

    on_exit(fn ->
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
    end)

    player = create_player()

    result =
      Commands.enqueue(
        player.id,
        "bonustime.play",
        intent(0, %{"game" => "chest_draw"}),
        @now
      )

    assert result["type"] == "bonustime.play.result"
    assert result["status"] == "ok"
    assert is_map(result["bonustime"])
    assert result["bonustime"]["active_game_id"] == "chest_draw"
    assert result["bonustime"]["rotation_anchor"] == DateTime.to_iso8601(@now)
  end

  test "cleanup deletes only ACKed command rows older than forty eight hours" do
    player = create_player()
    old = DateTime.add(@now, -49 * 60 * 60, :second)

    Commands.enqueue(player.id, "game.noop", intent(0), @now)
    Commands.ack(player.id, 0, @now)

    acked_command = Repo.one!(GameCommand)

    Repo.update_all(from(command in GameCommand, where: command.id == ^acked_command.id),
      set: [acked_at: old]
    )

    Commands.enqueue(player.id, "game.noop", intent(1), @now)
    unacked_command = Repo.one!(from command in GameCommand, where: is_nil(command.acked_at))

    Repo.update_all(
      from(command in GameCommand, where: command.id == ^unacked_command.id),
      set: [processed_at: old]
    )

    assert CommandLog.cleanup_acked(@now) == 1
    refute Repo.get(GameCommand, acked_command.id)
    assert Repo.get(GameCommand, unacked_command.id)
  end

  defp create_player do
    player = Sessions.authenticate_player(nil, @now)
    _snapshot = Sessions.boot_player(player.id, false, @now)
    Repo.get!(Player, player.id)
  end

  defp intent(command_id, attrs \\ %{}) do
    Map.put(attrs, "command_id", command_id)
  end

  defp command_statuses(player_id) do
    Repo.all(
      from command in GameCommand,
        where: command.player_id == ^player_id,
        order_by: [asc: command.sequence],
        select: command.status
    )
  end
end
