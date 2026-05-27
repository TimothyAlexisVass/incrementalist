defmodule Incrementalist.Game.CommandsTest do
  use Incrementalist.DataCase, async: false

  import Ecto.Query

  alias Incrementalist.Game.Commands
  alias Incrementalist.Game.Features.Quests.Rules, as: Quests

  alias Incrementalist.Game.Persistence.{
    CommandLog,
    GameCommand,
    Player,
    PlayerState,
    PlayerStates
  }

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

  test "time.sync returns global climate for all players at the same server time" do
    player_a = create_player()
    player_b = create_player()

    result_a = Commands.enqueue(player_a.id, "time.sync", intent(0), @now)
    result_b = Commands.enqueue(player_b.id, "time.sync", intent(0), @now)

    assert result_a["type"] == "time.sync.result"
    assert result_b["type"] == "time.sync.result"
    assert result_a["climate"] == result_b["climate"]
    assert is_integer(result_a["climate"]["year"])
    assert is_integer(result_a["climate"]["day_in_year"])
    assert is_number(result_a["climate"]["rain_mm"])
    assert is_number(result_a["climate"]["temperature_c"])
  end

  test "time.sync climate payload excludes client-derived presentation fields" do
    player = create_player()

    result = Commands.enqueue(player.id, "time.sync", intent(0), @now)

    assert result["type"] == "time.sync.result"
    refute Map.has_key?(result["climate"], "hour_ms")
    refute Map.has_key?(result["climate"], "hours_per_day")
    refute Map.has_key?(result["climate"], "season")
    refute Map.has_key?(result["climate"], "season_label")
    refute Map.has_key?(result["climate"], "day_phase")
  end

  test "time.sync starts climate years at 1008 on climate epoch" do
    Application.put_env(:incrementalist, :climate_epoch_override, DateTime.to_iso8601(@now))

    on_exit(fn ->
      Application.delete_env(:incrementalist, :climate_epoch_override)
    end)

    player = create_player()
    result = Commands.enqueue(player.id, "time.sync", intent(0), @now)

    assert result["type"] == "time.sync.result"
    assert result["climate"]["year"] == 1008
    assert result["climate"]["day_in_year"] == 1
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

  test "furnace.upgrade increments furnace level and updates furnace area metadata" do
    player = create_player()
    set_player_area(player.id, "furnace", 1)

    result = Commands.enqueue(player.id, "furnace.upgrade", intent(0), @now)

    assert result["type"] == "furnace.upgrade.result"
    assert result["furnace_level"] == 2
    assert result["area"] == "furnace"

    furnace_area =
      Enum.find(result["areas"], fn area ->
        (area[:key] || area["key"]) == "furnace"
      end)

    assert furnace_area
  end

  test "cloverfield locks after first four-leaf until clover_hunt rank 1 is claimed" do
    player = create_player()
    set_player_area(player.id, "cloverfield", 10)

    search = Commands.enqueue(player.id, "cloverfield.search", intent(0), @now)
    assert search["type"] == "cloverfield.search.result"
    assert search["clover_hunt"]["click_count"] == 100
    assert search["discoveries"] == ["four_leaf_1"]
    assert search["clover_hunt"]["background_stage"] == 2
    assert search["quests"]["clover_hunt"]["rank"] == 1
    assert search["quests"]["clover_hunt"]["claimed_rank"] == 0

    Commands.ack(player.id, 0, @now)

    confirm =
      Commands.enqueue(
        player.id,
        "cloverfield.confirm_discovery",
        intent(1, %{"discovery_id" => "four_leaf_1"}),
        @now
      )

    assert confirm["type"] == "cloverfield.confirm_discovery.result"
    assert confirm["area"] == "sage"

    cloverfield_area =
      Enum.find(confirm["areas"], fn area ->
        (area[:key] || area["key"]) == "cloverfield"
      end)

    assert cloverfield_area
    assert (cloverfield_area[:is_locked] || cloverfield_area["is_locked"]) == true

    assert (cloverfield_area[:lock_reason] || cloverfield_area["lock_reason"]) ==
             "Claim the Quest first!"

    Commands.ack(player.id, 1, @now)

    locked =
      Commands.enqueue(player.id, "area.select", intent(2, %{"area" => "cloverfield"}), @now)

    assert locked["type"] == "command.error"
    assert locked["reason"] == "area_locked"

    Commands.ack(player.id, 2, @now)

    claim =
      Commands.enqueue(player.id, "quest.claim", intent(3, %{"quest_id" => "clover_hunt"}), @now)

    assert claim["type"] == "quest.claim.result"
    assert claim["quests"]["clover_hunt"]["claimed_rank"] >= 1

    Commands.ack(player.id, 3, @now)

    unlocked =
      Commands.enqueue(player.id, "area.select", intent(4, %{"area" => "cloverfield"}), @now)

    assert unlocked["type"] == "area.select.result"
    assert unlocked["area"] == "cloverfield"
  end

  test "confirming six-leaf discovery removes cloverfield, not clover_hunt rank 3 claim" do
    player = create_player()
    set_player_area(player.id, "cloverfield", 10)

    # 100 -> first 4-leaf
    assert Commands.enqueue(player.id, "cloverfield.search", intent(0), @now)["type"] ==
             "cloverfield.search.result"

    Commands.ack(player.id, 0, @now)

    assert Commands.enqueue(
             player.id,
             "cloverfield.confirm_discovery",
             intent(1, %{"discovery_id" => "four_leaf_1"}),
             @now
           )["type"] == "cloverfield.confirm_discovery.result"

    Commands.ack(player.id, 1, @now)

    assert Commands.enqueue(
             player.id,
             "quest.claim",
             intent(2, %{"quest_id" => "clover_hunt"}),
             @now
           )[
             "type"
           ] == "quest.claim.result"

    Commands.ack(player.id, 2, @now)

    assert Commands.enqueue(player.id, "area.select", intent(3, %{"area" => "cloverfield"}), @now)[
             "type"
           ] == "area.select.result"

    Commands.ack(player.id, 3, @now)

    # 200 -> second 4-leaf
    assert Commands.enqueue(player.id, "cloverfield.search", intent(4), @now)["type"] ==
             "cloverfield.search.result"

    Commands.ack(player.id, 4, @now)

    # 300 -> first 5-leaf
    assert Commands.enqueue(player.id, "cloverfield.search", intent(5), @now)["type"] ==
             "cloverfield.search.result"

    Commands.ack(player.id, 5, @now)

    five_confirm =
      Commands.enqueue(
        player.id,
        "cloverfield.confirm_discovery",
        intent(6, %{"discovery_id" => "five_leaf_1"}),
        @now
      )

    assert five_confirm["type"] == "cloverfield.confirm_discovery.result"
    assert five_confirm["area"] == "sage"

    Commands.ack(player.id, 6, @now)

    locked_attempt =
      Commands.enqueue(player.id, "area.select", intent(7, %{"area" => "cloverfield"}), @now)

    assert locked_attempt["type"] == "command.error"
    assert locked_attempt["reason"] == "area_locked"

    Commands.ack(player.id, 7, @now)

    claim_rank_2 =
      Commands.enqueue(player.id, "quest.claim", intent(8, %{"quest_id" => "clover_hunt"}), @now)

    assert claim_rank_2["type"] == "quest.claim.result"
    assert claim_rank_2["quests"]["clover_hunt"]["claimed_rank"] >= 2

    Commands.ack(player.id, 8, @now)

    assert Commands.enqueue(player.id, "area.select", intent(9, %{"area" => "cloverfield"}), @now)[
             "type"
           ] == "area.select.result"

    Commands.ack(player.id, 9, @now)

    # 400, 500, 600
    assert Commands.enqueue(player.id, "cloverfield.search", intent(0), @now)["type"] ==
             "cloverfield.search.result"

    Commands.ack(player.id, 0, @now)

    assert Commands.enqueue(player.id, "cloverfield.search", intent(1), @now)["type"] ==
             "cloverfield.search.result"

    Commands.ack(player.id, 1, @now)

    six_discovery = Commands.enqueue(player.id, "cloverfield.search", intent(2), @now)
    assert six_discovery["type"] == "cloverfield.search.result"
    assert "six_leaf_1" in six_discovery["discoveries"]

    Commands.ack(player.id, 2, @now)

    claim_rank_3 =
      Commands.enqueue(player.id, "quest.claim", intent(3, %{"quest_id" => "clover_hunt"}), @now)

    assert claim_rank_3["type"] == "quest.claim.result"
    assert claim_rank_3["quests"]["clover_hunt"]["claimed_rank"] >= 3

    area_keys_before_confirmation = Enum.map(claim_rank_3["areas"], &(&1[:key] || &1["key"]))
    assert "cloverfield" in area_keys_before_confirmation

    Commands.ack(player.id, 3, @now)

    six_confirm =
      Commands.enqueue(
        player.id,
        "cloverfield.confirm_discovery",
        intent(4, %{"discovery_id" => "six_leaf_1"}),
        @now
      )

    assert six_confirm["type"] == "cloverfield.confirm_discovery.result"
    assert six_confirm["area"] == "sage"

    area_keys_after_confirmation = Enum.map(six_confirm["areas"], &(&1[:key] || &1["key"]))
    refute "cloverfield" in area_keys_after_confirmation

    Commands.ack(player.id, 4, @now)

    unavailable =
      Commands.enqueue(player.id, "area.select", intent(5, %{"area" => "cloverfield"}), @now)

    assert unavailable["type"] == "command.error"
    assert unavailable["reason"] == "unknown_area"
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
      Incrementalist.Game.Constants.sage_tip_level_unlocks()
      |> Map.keys()
      |> Enum.reject(&(&1 == "1"))
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

  test "bonustime.play keeps projected active game id in command result bonustime payload" do
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
    refute Map.has_key?(result["bonustime"], "rotation_anchor")
  end

  test "bonustime.play plinko_drop includes authoritative roll payload in last_result" do
    plinko_anchor = DateTime.add(@now, -(4 * 43_200_000), :millisecond)

    Application.put_env(
      :incrementalist,
      :bonustime_rotation_anchor_override,
      DateTime.to_iso8601(plinko_anchor)
    )

    on_exit(fn ->
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
    end)

    player = create_player()

    result =
      Commands.enqueue(
        player.id,
        "bonustime.play",
        intent(0, %{"game" => "plinko_drop"}),
        @now
      )

    assert result["type"] == "bonustime.play.result"
    assert result["status"] == "ok"
    assert result["bonustime"]["active_game_id"] == "plinko_drop"

    last_result = result["bonustime"]["last_result"] || result["bonustime"][:last_result]
    assert last_result["game_id"] == "plinko_drop"
    assert is_list(last_result["rolls"])
    assert length(last_result["rolls"]) == 13
    assert hd(last_result["rolls"]) == true
    assert Enum.all?(last_result["rolls"], &is_boolean/1)
    assert is_map(last_result["plinko"])
    assert is_list(last_result["plinko"]["drops"])
    assert length(last_result["plinko"]["drops"]) >= 1
    assert is_integer(last_result["plinko"]["best_drop_index"])
  end

  test "bonustime.play ladder_climb includes authoritative roll payload in last_result" do
    ladder_anchor = DateTime.add(@now, -(7 * 43_200_000), :millisecond)

    Application.put_env(
      :incrementalist,
      :bonustime_rotation_anchor_override,
      DateTime.to_iso8601(ladder_anchor)
    )

    on_exit(fn ->
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
    end)

    player = create_player()

    result =
      Commands.enqueue(
        player.id,
        "bonustime.play",
        intent(0, %{"game" => "ladder_climb"}),
        @now
      )

    assert result["type"] == "bonustime.play.result"
    assert result["status"] == "ok"
    assert result["bonustime"]["active_game_id"] == "ladder_climb"

    last_result = result["bonustime"]["last_result"] || result["bonustime"][:last_result]
    assert last_result["game_id"] == "ladder_climb"
    assert is_integer(last_result["tier"])
    assert last_result["tier"] in 1..7
    assert is_list(last_result["rolls"])
    assert length(last_result["rolls"]) >= 1

    first_step = hd(last_result["rolls"])
    assert first_step["from_rung"] == 1
    assert first_step["target_rung"] == 2
    assert first_step["reached_rung"] in [1, 2]
    assert is_boolean(first_step["success"])
    assert is_number(first_step["chance"])
  end

  test "bonustime.play scratch_card includes authoritative budget and reveal schedule payload" do
    scratch_anchor = DateTime.add(@now, -(11 * 43_200_000), :millisecond)

    min_threshold_gap_pixels =
      Incrementalist.Game.Constants.bonustime_game_rules()["scratch_card"]["reveal_schedule"][
        "min_threshold_gap_pixels"
      ]

    Application.put_env(
      :incrementalist,
      :bonustime_rotation_anchor_override,
      DateTime.to_iso8601(scratch_anchor)
    )

    on_exit(fn ->
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
    end)

    player = create_player()

    result =
      Commands.enqueue(
        player.id,
        "bonustime.play",
        intent(0, %{"game" => "scratch_card"}),
        @now
      )

    assert result["type"] == "bonustime.play.result"
    assert result["status"] == "ok"
    assert result["bonustime"]["active_game_id"] == "scratch_card"

    last_result = result["bonustime"]["last_result"] || result["bonustime"][:last_result]
    assert last_result["game_id"] == "scratch_card"
    assert is_integer(last_result["pixels_budget"])
    assert last_result["pixels_budget"] > 0
    assert is_list(last_result["reveal_schedule"])
    assert length(last_result["reveal_schedule"]) >= 1
    refute Map.has_key?(last_result, "positions")
    refute Map.has_key?(last_result, "cells")
    refute Map.has_key?(last_result, "item_positions")

    assert Enum.all?(last_result["reveal_schedule"], fn reveal ->
             is_map(reveal) and
               is_integer(reveal["pixels"]) and
               reveal["pixels"] >= 1 and
               reveal["pixels"] <= last_result["pixels_budget"] and
               is_integer(reveal["tier"]) and reveal["tier"] in 1..7
           end)

    sorted =
      last_result["reveal_schedule"]
      |> Enum.sort_by(& &1["pixels"])

    assert sorted == last_result["reveal_schedule"]

    sorted
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.each(fn [left, right] ->
      assert right["pixels"] - left["pixels"] >= min_threshold_gap_pixels
    end)
  end

  test "bonustime.play lucky_dice finalizes on the initial throw when only one throw is available" do
    lucky_dice_anchor = DateTime.add(@now, -(9 * 43_200_000), :millisecond)

    Application.put_env(
      :incrementalist,
      :bonustime_rotation_anchor_override,
      DateTime.to_iso8601(lucky_dice_anchor)
    )

    on_exit(fn ->
      Application.delete_env(:incrementalist, :bonustime_rotation_anchor_override)
    end)

    player = create_player()

    start_result =
      Commands.enqueue(
        player.id,
        "bonustime.play",
        intent(0, %{"game" => "lucky_dice", "action" => "throw", "held_indexes" => []}),
        @now
      )

    assert start_result["type"] == "bonustime.play.result"
    assert start_result["status"] == "ok"
    assert start_result["bonustime"]["active_game_id"] == "lucky_dice"

    assert start_result["bonustime"]["active_session"] == nil

    last_result =
      start_result["bonustime"]["last_result"] || start_result["bonustime"][:last_result]

    assert last_result["game_id"] == "lucky_dice"
    assert last_result["tier"] in 1..7
    assert is_list(last_result["claimed_tiers"])
    assert length(last_result["claimed_tiers"]) == 1
    assert is_list(last_result["dice"])
    assert length(last_result["dice"]) == 7

    start_ack = Commands.ack(player.id, 0, @now)
    assert start_ack["released_result"] == nil
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

  defp set_player_area(player_id, area_key, level) do
    ps = PlayerStates.get!(player_id)

    next_state =
      ps.state
      |> Map.put(:level, level)
      |> Map.put(:area, area_key)
      |> Quests.evaluate()

    ps
    |> PlayerState.changeset(%{
      state: next_state,
      notices: Notices.new(next_state),
      last_saved_at: @now
    })
    |> Repo.update!()
  end
end
