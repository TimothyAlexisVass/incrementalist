defmodule Incrementalist.Game.CommandsTest do
  use Incrementalist.DataCase, async: false

  import Ecto.Query

  alias Incrementalist.Game.Commands
  alias Incrementalist.Game.Persistence.{CommandLog, GameCommand, Player, SaveSlot, SaveSlots}
  alias Incrementalist.Game.{Sessions, State, Time}
  alias Incrementalist.Repo

  @now ~U[2026-05-04 12:00:00Z]

  test "anonymous sessions create four save slots and boot chooses slot zero when empty" do
    session = Sessions.authenticate_anonymous(nil, @now)

    slots = SaveSlots.get_slots(session.player.id)
    assert Enum.map(slots, & &1.slot_index) == [0, 1, 2, 3]

    boot = Sessions.boot_player(session.player.id, session.anonymous_player_token, @now)

    refute Map.has_key?(boot, "slots")
    assert boot["snapshot"]["active_save_slot"] == 0
    assert boot["snapshot"]["save_slot"]["has_data"]
    refute Map.has_key?(boot["snapshot"], "state_version")
    refute Map.has_key?(boot["snapshot"]["save_slot"], "state_version")
  end

  test "boot can omit a full snapshot when the active slot is cached by the client" do
    session = Sessions.authenticate_anonymous(nil, @now)
    _initial_boot = Sessions.boot_player(session.player.id, session.anonymous_player_token, @now)

    cached_boot =
      Sessions.boot_player(
        session.player.id,
        session.anonymous_player_token,
        MapSet.new([0]),
        @now
      )

    assert cached_boot["active_save_slot"] == 0
    assert cached_boot["save_slot"]["slot_index"] == 0
    assert cached_boot["save_slot"]["has_data"]
    assert cached_boot["snapshot"] == nil
    refute Map.has_key?(cached_boot, "slots")
  end

  test "boot selection uses last valid slot, then first populated slot, then slot zero" do
    session = Sessions.authenticate_anonymous(nil, @now)
    player = session.player

    slot_1 = SaveSlots.get_slot!(player.id, 1)
    slot_2 = SaveSlots.get_slot!(player.id, 2)

    put_slot_state(slot_1, State.new(@now), @now)
    put_slot_state(slot_2, State.new(@now), @now)
    put_player_active_slot(player, 2)

    assert SaveSlots.determine_active_slot(Repo.get!(Player, player.id), @now).slot_index == 2

    slot_2 |> SaveSlot.changeset(%{state: nil}) |> Repo.update!()
    put_player_active_slot(player, 3)

    assert SaveSlots.determine_active_slot(Repo.get!(Player, player.id), @now).slot_index == 1

    SaveSlots.get_slots(player.id)
    |> Enum.each(fn slot ->
      slot |> SaveSlot.changeset(%{state: nil}) |> Repo.update!()
    end)

    put_player_active_slot(player, 3)

    selected_slot = SaveSlots.determine_active_slot(Repo.get!(Player, player.id), @now)
    assert selected_slot.slot_index == 0
    assert is_map(selected_slot.state)
  end

  test "commands are FIFO and ACK-gated" do
    player = create_player()

    first = Commands.enqueue(player.id, "game.noop", %{}, @now)
    second = Commands.enqueue(player.id, "save_slots.list", %{}, @now)
    third = Commands.enqueue(player.id, "save_slot.switch", %{"slot_index" => 1}, @now)

    assert first["type"] == "game.noop.result"
    refute Map.has_key?(first, "requires_ack")
    assert second["type"] == "command.queued"
    refute Map.has_key?(second, "requires_ack")
    assert third["type"] == "command.queued"
    assert command_statuses(player.id) == ["succeeded", "queued", "queued"]

    ack = Commands.ack(player.id, @now)
    assert ack["acked"]
    refute Map.has_key?(ack, "next_result")
    refute Map.has_key?(ack, "requires_ack")
    assert ack["released_result"]["type"] == "save_slots.list.result"
    assert command_statuses(player.id) == ["acked", "succeeded", "queued"]

    ack = Commands.ack(player.id, @now)
    assert ack["released_result"]["type"] == "save_slot.switch.result"
    assert ack["released_result"]["snapshot"]["active_save_slot"] == 1
    assert command_statuses(player.id) == ["acked", "acked", "succeeded"]
  end

  test "slot switch trusts cache hints only to omit snapshots for populated slots" do
    player = create_player()

    slot_1 = SaveSlots.get_slot!(player.id, 1)
    put_slot_state(slot_1, State.new(@now), @now)

    cached_result =
      Commands.enqueue(
        player.id,
        "save_slot.switch",
        %{"slot_index" => 1, "has_cached_snapshot" => true},
        @now
      )

    assert cached_result["type"] == "save_slot.switch.result"
    assert cached_result["active_save_slot"] == 1
    assert cached_result["save_slot"]["slot_index"] == 1
    assert length(cached_result["slots"]) == 4
    refute Map.has_key?(cached_result, "snapshot")

    Commands.ack(player.id, @now)

    empty_slot_result =
      Commands.enqueue(
        player.id,
        "save_slot.switch",
        %{"slot_index" => 2, "has_cached_snapshot" => true},
        @now
      )

    assert empty_slot_result["type"] == "save_slot.switch.result"
    assert empty_slot_result["snapshot"]["active_save_slot"] == 2
  end

  test "stored results replay without re-executing command rules" do
    player = create_player()

    result = Commands.enqueue(player.id, "save_slot.reset", %{}, @now)
    replayed_once = Commands.replay_pending(player.id)
    replayed_twice = Commands.replay_pending(player.id)

    assert replayed_once == result
    assert replayed_twice == result
    assert Repo.aggregate(GameCommand, :count) == 1

    command = Repo.one!(GameCommand)
    assert command.replay_count == 2

    refute Map.has_key?(result["snapshot"], "state_version")
    refute Map.has_key?(command, :state_version)

    Commands.ack(player.id, @now)
    assert Commands.replay_pending(player.id) == nil
  end

  test "queue full rejects the eleventh pending command" do
    player = create_player()

    assert Commands.enqueue(player.id, "game.noop", %{}, @now)["type"] == "game.noop.result"

    for _ <- 1..9 do
      assert Commands.enqueue(player.id, "game.noop", %{}, @now)["type"] == "command.queued"
    end

    rejected = Commands.enqueue(player.id, "game.noop", %{}, @now)

    assert rejected["type"] == "command.rejected"
    assert rejected["reason"] == "queue_full"
    refute Map.has_key?(rejected, "requires_ack")
    assert Repo.aggregate(GameCommand, :count) == 10
  end

  test "reconnect boot includes the unacked stored result" do
    session = Sessions.authenticate_anonymous(nil, @now)
    player = session.player

    result = Commands.enqueue(player.id, "game.noop", %{}, @now)

    boot =
      player.id
      |> Sessions.boot_player(session.anonymous_player_token, @now)
      |> Map.put("pending_result", Commands.replay_pending(player.id))

    assert boot["pending_result"] == result
  end

  test "cleanup deletes only ACKed command rows older than forty eight hours" do
    player = create_player()
    old = DateTime.add(@now, -49 * 60 * 60, :second)

    Commands.enqueue(player.id, "game.noop", %{}, @now)
    Commands.ack(player.id, @now)

    acked_command = Repo.one!(GameCommand)

    Repo.update_all(from(command in GameCommand, where: command.id == ^acked_command.id),
      set: [acked_at: old]
    )

    Commands.enqueue(player.id, "game.noop", %{}, @now)
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
    session = Sessions.authenticate_anonymous(nil, @now)
    _snapshot = Sessions.boot_player(session.player.id, session.anonymous_player_token, @now)
    Repo.get!(Player, session.player.id)
  end

  defp command_statuses(player_id) do
    Repo.all(
      from command in GameCommand,
        where: command.player_id == ^player_id,
        order_by: [asc: command.sequence],
        select: command.status
    )
  end

  defp put_slot_state(%SaveSlot{} = slot, state, now) do
    slot
    |> SaveSlot.changeset(%{
      state: state,
      last_saved_at: now
    })
    |> Repo.update!()
  end

  defp put_player_active_slot(%Player{} = player, slot_index) do
    player
    |> Player.changeset(%{active_save_slot: slot_index, last_seen_at: Time.now()})
    |> Repo.update!()
  end
end
