defmodule Incrementalist.Game.CommandsTest do
  use Incrementalist.DataCase, async: false

  import Ecto.Query

  alias Incrementalist.Game.Commands
  alias Incrementalist.Game.Persistence.{CommandLog, GameCommand, Player, SaveSlot, SaveSlots}
  alias Incrementalist.Game.Session.PlayerServer
  alias Incrementalist.Game.{Sessions, State, Time}
  alias Incrementalist.Repo

  @now ~U[2026-05-04 12:00:00Z]

  test "anonymous sessions create four save slots and boot chooses slot zero when empty" do
    player = Sessions.authenticate_player(nil, @now)

    slots = SaveSlots.get_slots(player.id)
    assert Enum.map(slots, & &1.slot_index) == [0, 1, 2, 3]

    boot = Sessions.boot_player(player.id, MapSet.new(), @now)

    refute Map.has_key?(boot, "slots")
    assert boot["username"] == player.username
    assert boot["snapshot"]["active_save_slot"] == 0
    assert boot["snapshot"]["save_slot"]["has_data"]
    refute Map.has_key?(boot["snapshot"], "state_version")
    refute Map.has_key?(boot["snapshot"]["save_slot"], "state_version")
  end

  test "boot can omit a full snapshot when the active slot is cached by the client" do
    player = Sessions.authenticate_player(nil, @now)
    _initial_boot = Sessions.boot_player(player.id, MapSet.new(), @now)

    cached_boot =
      Sessions.boot_player(
        player.id,
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
    player = Sessions.authenticate_player(nil, @now)

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
    assert match?(%State{}, selected_slot.state)
  end

  test "commands are FIFO and ACK-gated" do
    player = create_player()

    first = Commands.enqueue(player.id, "game.noop", intent(0), @now)
    second = Commands.enqueue(player.id, "save_slots.list", intent(1), @now)
    third = Commands.enqueue(player.id, "save_slot.switch", intent(2, %{"slot_index" => 1}), @now)

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
    assert ack["released_result"]["type"] == "save_slots.list.result"
    assert ack["released_result"]["command_id"] == 1
    assert command_statuses(player.id) == ["acked", "succeeded"]

    ack = Commands.ack(player.id, 1, @now)
    assert ack["released_result"]["type"] == "save_slot.switch.result"
    assert ack["released_result"]["command_id"] == 2
    assert ack["released_result"]["snapshot"]["active_save_slot"] == 1
    assert command_statuses(player.id) == ["acked", "acked", "succeeded"]
  end

  test "ack ignores command ids that are not the current blocking result" do
    player = create_player()

    Commands.enqueue(player.id, "game.noop", intent(0), @now)
    Commands.enqueue(player.id, "save_slots.list", intent(1), @now)

    ignored = Commands.ack(player.id, 1, @now)

    assert ignored["command_id"] == 1
    assert ignored["released_result"] == nil
    assert command_statuses(player.id) == ["succeeded"]

    released = Commands.ack(player.id, 0, @now)

    assert released["released_result"]["type"] == "save_slots.list.result"
    assert released["released_result"]["command_id"] == 1
    assert command_statuses(player.id) == ["acked", "succeeded"]
  end

  test "slot switch trusts cache hints only to omit snapshots for populated slots" do
    player = create_player()

    slot_1 = SaveSlots.get_slot!(player.id, 1)
    put_slot_state(slot_1, State.new(@now), @now)

    cached_result =
      Commands.enqueue(
        player.id,
        "save_slot.switch",
        intent(0, %{"slot_index" => 1, "has_cached_snapshot" => true}),
        @now
      )

    assert cached_result["type"] == "save_slot.switch.result"
    assert cached_result["active_save_slot"] == 1
    assert cached_result["save_slot"]["slot_index"] == 1
    assert length(cached_result["slots"]) == 4
    refute Map.has_key?(cached_result, "snapshot")

    Commands.ack(player.id, 0, @now)

    empty_slot_result =
      Commands.enqueue(
        player.id,
        "save_slot.switch",
        intent(1, %{"slot_index" => 2, "has_cached_snapshot" => true}),
        @now
      )

    assert empty_slot_result["type"] == "save_slot.switch.result"
    assert empty_slot_result["snapshot"]["active_save_slot"] == 2
  end

  test "stored results replay without re-executing command rules" do
    player = create_player()

    result = Commands.enqueue(player.id, "save_slot.reset", intent(0), @now)
    replayed_once = Commands.replay_pending(player.id)
    replayed_twice = Commands.replay_pending(player.id)

    assert replayed_once == result
    assert replayed_twice == result
    assert result["command_id"] == 0
    assert Repo.aggregate(GameCommand, :count) == 1

    command = Repo.one!(GameCommand)
    assert command.replay_count == 2

    refute Map.has_key?(result["snapshot"], "state_version")
    refute Map.has_key?(command, :state_version)

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

  test "save slot boundaries block follow-up commands until acknowledged" do
    player = create_player()

    Commands.enqueue(player.id, "game.noop", intent(0), @now)

    switch =
      Commands.enqueue(player.id, "save_slot.switch", intent(1, %{"slot_index" => 1}), @now)

    assert switch["type"] == "command.queued"
    assert Commands.enqueue(player.id, "game.noop", intent(2), @now) == :queue_full

    ack = Commands.ack(player.id, 0, @now)

    assert ack["released_result"]["type"] == "save_slot.switch.result"
    assert ack["released_result"]["command_id"] == 1
    assert command_statuses(player.id) == ["acked", "succeeded"]

    ack = Commands.ack(player.id, 1, @now)

    assert ack["released_result"] == nil
    assert command_statuses(player.id) == ["acked", "acked"]
  end

  test "reconnect boot includes the unacked stored result" do
    player = Sessions.authenticate_player(nil, @now)

    result = Commands.enqueue(player.id, "game.noop", intent(0), @now)

    boot =
      player.id
      |> Sessions.boot_player(MapSet.new(), @now)
      |> Map.put("pending_result", Commands.replay_pending(player.id))

    assert boot["pending_result"] == result
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
    _snapshot = Sessions.boot_player(player.id, MapSet.new(), @now)
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
