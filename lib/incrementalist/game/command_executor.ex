defmodule Incrementalist.Game.CommandExecutor do
  @moduledoc """
  Decouples the business logic for executing gameplay commands from the queue
  persistence.

  It maps a `command_type` to game changes, processing the command intent and
  the current state, and applying changes to the database.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Persistence.{GameCommand, Player, SaveSlot, SaveSlots}
  alias Incrementalist.Game.{Notices, Snapshots, State, Time}
  alias Incrementalist.Game.Features.Progress.{Bar, Sisu}
  alias Incrementalist.Game.Features.Quests.Rules, as: Quests
  alias Incrementalist.Game.Features.Achievements.Rules, as: Achievements
  alias Incrementalist.Game.Features.DailyBonus.Rules, as: DailyBonus
  alias Incrementalist.Game.Features.DailyBonus.Games.ChestDraw
  alias Incrementalist.Repo
  import Ecto.Query

  @doc """
  Executes the game rules for a specific command.

  Returns a tuple `{status, result, save_slot_id}` to be recorded by the queue manager.
  """
  def execute(%GameCommand{} = command, %Player{} = player, now) do
    # The tuple captures the execution boundary: queue status, replayable client
    # payload, and the save slot affected by the command.
    case command.command_type do
      "game.noop" ->
        active_slot = active_slot(player, now)

        {"succeeded",
         %{
           "type" => "game.noop.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "server_time" => Time.iso8601(now),
           "events" => []
         }, active_slot.id}

      "progress.claim_in" ->
        active_slot = active_slot(player, now)
        {next_state, can_claim_in} = Bar.ensure_can_claim_at(active_slot.state, now)

        next_notices =
          Notices.refresh_for_state_transition(
            active_slot.notices || Notices.new(active_slot.state),
            active_slot.state,
            next_state
          )

        if next_state != active_slot.state or next_notices != active_slot.notices do
          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })
        end

        {"succeeded",
         Map.merge(
           %{
             "type" => "progress.claim_in.result",
             "command_id" => command.command_id,
             "can_claim_in" => can_claim_in,
             "sisu" => next_state.sisu,
             "notices" => Notices.payload(next_notices)
           },
           State.projection_params(next_state, now)
         ), active_slot.id}

      "progress.claim_reward" ->
        active_slot = active_slot(player, now)
        {scheduled_state, can_claim_in} = Bar.ensure_can_claim_at(active_slot.state, now)

        if can_claim_in <= 0 do
          # Compute changes and apply state logic
          new_state =
            scheduled_state
            |> Bar.claim_reward()
            |> Incrementalist.Game.Rewards.apply_level_ups()
            |> Sisu.advance_cycle(now)
            |> Bar.finalize_claim(now)
            |> Quests.evaluate()
            |> Achievements.evaluate()

          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              new_state
            )

          update_active_slot(active_slot, %{
            state: new_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           %{
             "type" => "progress.claim_reward.result",
             "command_id" => command.command_id,
             "coins" => new_state.coins,
             "exp" => new_state.exp,
             "level" => new_state.level,
             "shards" => new_state.shards,
             "cores" => new_state.cores,
             "charge_crystals" => new_state.charge_crystals,
             "sisu" => new_state.sisu,
             "quests" => State.visible_quests(new_state.quests),
             "achievements" => State.visible_achievements(new_state.achievements),
             "stats" => new_state.stats,
             "notices" => Notices.payload(next_notices)
           }, active_slot.id}
        else
          {"failed",
           %{
             "type" => "command.error",
             "status" => "error",
             "command_id" => command.command_id,
             "reason" => "claim_not_ready",
             "can_claim_in" => can_claim_in,
             "sisu" => scheduled_state.sisu,
             "can_claim_at" => scheduled_state.can_claim_at
           }, active_slot.id}
        end

      "save_slots.list" ->
        active_slot = active_slot(player, now)

        {"succeeded",
         %{
           "type" => "save_slots.list.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "server_time" => Time.iso8601(now),
           "active_save_slot" => active_slot.slot_index,
           "slots" => SaveSlots.summaries(player.id, active_slot.slot_index)
         }, active_slot.id}

      "save_slot.switch" ->
        execute_switch(player, command, now)

      "save_slot.reset" ->
        execute_reset(player, command, now)

      "area.select" ->
        active_slot = active_slot(player, now)

        with {:ok, area_key} <- fetch_area_key(command.intent),
             {:ok, next_state} <-
               Incrementalist.Game.Features.Areas.select_area(active_slot.state, area_key) do
          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              next_state
            )

          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           %{
             "type" => "area.select.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "area" => area_key,
             "notices" => Notices.payload(next_notices)
           }, active_slot.id}
        else
          {:error, reason} ->
            {"failed",
             error_result(reason, command, %{
               "can_claim_at" => active_slot.state.can_claim_at
             }), active_slot.id}
        end

      "progress.set_idle_mode" ->
        active_slot = active_slot(player, now)

        with {:ok, enabled} <- fetch_boolean(command.intent, "enabled"),
             {:ok, intermediate_state} <- Bar.set_idle_mode(active_slot.state, enabled) do
          # TODO: Looks like we can remove the old, unused _can_claim_in from here
          {next_state, _can_claim_in} = Bar.ensure_can_claim_at(intermediate_state, now)

          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              next_state
            )

          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           Map.merge(
             %{
               "type" => "progress.set_idle_mode.result",
               "status" => "ok",
               "command_id" => command.command_id,
               "idle_mode" => enabled,
               "notices" => Notices.payload(next_notices)
             },
             State.projection_params(next_state, now)
           ), active_slot.id}
        else
          {:error, reason} ->
            {"failed",
             error_result(reason, command, %{
               "can_claim_at" => active_slot.state.can_claim_at
             }), active_slot.id}
        end

      "sisu.refill" ->
        active_slot = active_slot(player, now)

        with {:ok, tier_id} <- fetch_tier_id(command.intent),
             {:ok, next_state} <- Sisu.refill(active_slot.state, tier_id, now) do
          next_state = Achievements.evaluate(next_state)

          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              next_state
            )

          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           Map.merge(
             %{
               "type" => "sisu.refill.result",
               "status" => "ok",
               "command_id" => command.command_id,
               "tier_id" => tier_id,
               "charge_crystals" => next_state.charge_crystals,
               "sisu" => next_state.sisu,
               "quests" => State.visible_quests(next_state.quests),
               "achievements" => State.visible_achievements(next_state.achievements),
               "stats" => next_state.stats,
               "notices" => Notices.payload(next_notices)
             },
             State.projection_params(next_state, now)
           ), active_slot.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), active_slot.id}
        end

      "sisu.upgrade_max" ->
        active_slot = active_slot(player, now)

        with {:ok, next_state} <- Sisu.upgrade_max(active_slot.state, now) do
          next_state = Achievements.evaluate(next_state)

          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              next_state
            )

          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           Map.merge(
             %{
               "type" => "sisu.upgrade_max.result",
               "status" => "ok",
               "command_id" => command.command_id,
               "sisu" => next_state.sisu,
               "shards" => next_state.shards,
               "quests" => State.visible_quests(next_state.quests),
               "achievements" => State.visible_achievements(next_state.achievements),
               "stats" => next_state.stats,
               "notices" => Notices.payload(next_notices)
             },
             State.projection_params(next_state, now)
           ), active_slot.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), active_slot.id}
        end

      "shop.purchase" ->
        active_slot = active_slot(player, now)

        with {:ok, item_id} <- fetch_item_id(command.intent),
             {:ok, intermediate_state} <-
               Incrementalist.Game.Features.Shop.purchase(active_slot.state, item_id) do
          intermediate_state = Achievements.evaluate(intermediate_state)

          intermediate_state =
            if item_id == "sisu_generator" do
              Sisu.initialize_generator(intermediate_state, now)
            else
              intermediate_state
            end

          {next_state, _can_claim_in} = Bar.ensure_can_claim_at(intermediate_state, now)

          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              next_state
            )

          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           Map.merge(
             %{
               "type" => "shop.purchase.result",
               "status" => "ok",
               "command_id" => command.command_id,
               "item_id" => item_id,
               "coins" => next_state.coins,
               "shards" => next_state.shards,
               "cores" => next_state.cores,
               "sisu" => next_state.sisu,
               "quests" => State.visible_quests(next_state.quests),
               "achievements" => State.visible_achievements(next_state.achievements),
               "stats" => next_state.stats,
               "notices" => Notices.payload(next_notices)
             },
             State.projection_params(next_state, now)
           ), active_slot.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), active_slot.id}
        end

      "notice.event" ->
        active_slot = active_slot(player, now)

        with {:ok, event_kind} <- fetch_notice_event_kind(command.intent),
             {:ok, leaf_id} <- fetch_leaf_id(command.intent),
             true <- Notices.valid_event_kind?(event_kind),
             true <- Notices.valid_leaf_id?(leaf_id) do
          next_notices =
            Notices.apply_event(
              active_slot.notices || Notices.new(active_slot.state),
              event_kind,
              leaf_id
            )

          update_active_slot(active_slot, %{notices: next_notices, last_saved_at: now})

          {"succeeded",
           %{
             "type" => "notice.event.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "event" => Atom.to_string(event_kind),
             "leaf_id" => leaf_id,
             "notices" => Notices.payload(next_notices)
           }, active_slot.id}
        else
          false ->
            {"failed", error_result("invalid_notice_event", command), active_slot.id}

          {:error, reason} ->
            {"failed", error_result(reason, command), active_slot.id}
        end

      "quest.claim" ->
        active_slot = active_slot(player, now)

        with {:ok, quest_id} <- fetch_quest_id(command.intent),
             {:ok, next_state} <- Quests.claim(active_slot.state, quest_id) do
          next_state = Achievements.evaluate(next_state)

          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              next_state
            )

          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           Map.merge(
             %{
               "type" => "quest.claim.result",
               "status" => "ok",
               "command_id" => command.command_id,
               "quest_id" => quest_id,
               "coins" => next_state.coins,
               "quests" => State.visible_quests(next_state.quests),
               "achievements" => State.visible_achievements(next_state.achievements),
               "stats" => next_state.stats,
               "notices" => Notices.payload(next_notices)
             },
             State.projection_params(next_state, now)
           ), active_slot.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), active_slot.id}
        end

      "stats.mark_viewed" ->
        active_slot = active_slot(player, now)

        with {:ok, screen_id} <- fetch_screen_id(command.intent) do
          new_stats =
            case screen_id do
              "stats" -> %{active_slot.state.stats | screens_viewed_stats: true}
              "quests" -> %{active_slot.state.stats | screens_viewed_quests: true}
              "achievements" -> %{active_slot.state.stats | screens_viewed_achievements: true}
              _ -> active_slot.state.stats
            end

          next_state = %{active_slot.state | stats: new_stats} |> Achievements.evaluate()

          if next_state != active_slot.state do
            update_active_slot(active_slot, %{state: next_state, last_saved_at: now})
          end

          {"succeeded",
           %{
             "type" => "stats.update.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "stats" => next_state.stats,
             "achievements" => State.visible_achievements(next_state.achievements),
             "notices" => active_slot.notices
           }, active_slot.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), active_slot.id}
        end

      "stats.graduate_tutorial" ->
        active_slot = active_slot(player, now)
        new_stats = %{active_slot.state.stats | tutorial_graduated: true}
        next_state = %{active_slot.state | stats: new_stats} |> Achievements.evaluate()

        if next_state != active_slot.state do
          update_active_slot(active_slot, %{state: next_state, last_saved_at: now})
        end

        {"succeeded",
         %{
           "type" => "stats.update.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "stats" => next_state.stats,
           "achievements" => State.visible_achievements(next_state.achievements),
           "notices" => active_slot.notices
         }, active_slot.id}

      "daily_bonus.play" ->
        active_slot = active_slot(player, now)

        with {:ok, next_state, token_type} <- DailyBonus.spend_token(active_slot.state),
             active_game_id <- DailyBonus.get_active_game_id(now),
             {:ok, game_id} <- fetch_game_id(command.intent),
             true <- game_id == active_game_id do
          # Execute game rules
          {tier, rolls} =
            case game_id do
              "chest_draw" -> ChestDraw.roll_reward(next_state.daily_bonus.streak)
              _ -> {1, [1]}
            end

          # Apply rewards
          {next_state, reward_amount} =
            Incrementalist.Game.Rewards.grant_bonus_reward(next_state, tier)

          # Update streak and metadata
          next_state = DailyBonus.advance_streak(next_state, now)

          daily_bonus = next_state.daily_bonus
          new_reward_counts = Map.update(daily_bonus.reward_counts, "tier_#{tier}", 1, &(&1 + 1))

          last_result = %{
            "game_id" => game_id,
            "tier" => tier,
            "rolls" => rolls,
            "reward_amount" => reward_amount,
            "token_type" => token_type,
            "played_at" => Time.iso8601(now)
          }

          next_daily_bonus = %{
            daily_bonus
            | total_games_played: daily_bonus.total_games_played + 1,
              reward_counts: new_reward_counts,
              last_result: last_result
          }

          next_state = %{next_state | daily_bonus: next_daily_bonus}
          next_state = Achievements.evaluate(next_state)

          next_notices =
            Notices.refresh_for_state_transition(
              active_slot.notices || Notices.new(active_slot.state),
              active_slot.state,
              next_state
            )

          update_active_slot(active_slot, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           %{
             "type" => "daily_bonus.play.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "coins" => next_state.coins,
             "has_daily_token" => next_state.has_daily_token,
             "daily_bonus" => next_state.daily_bonus,
             "achievements" => State.visible_achievements(next_state.achievements),
             "notices" => Notices.payload(next_notices)
           }, active_slot.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), active_slot.id}

          false ->
            {"failed", error_result("game_not_available", command), active_slot.id}

          _ ->
            {"failed", error_result("invalid_request", command), active_slot.id}
        end

      _unknown ->
        active_slot = active_slot(player, now)

        {"failed", error_result("unknown_command", command), active_slot.id}
    end
  end

  defp execute_switch(%Player{} = player, %GameCommand{} = command, now) do
    active_slot = active_slot(player, now)

    with {:ok, slot_index} <- fetch_slot_index(command.intent) do
      # Switching is a command because the current active slot is server truth.
      # The previous slot is saved before the active pointer moves.

      # We check if the target slot had state before switching, since switch_player_to_slot
      # initializes the state if it was missing. We do this efficiently by fetching all slots
      # which might be slightly redundant with the fetch inside switch_player_to_slot, but
      # avoid a direct `get_slot!` query. Actually, we could just do `get_slots` here.
      slots = SaveSlots.get_slots(player.id)
      target_slot_initial = Enum.find(slots, &(&1.slot_index == slot_index))
      target_had_state = target_slot_initial && target_slot_initial.state != nil

      use_cached_snapshot = target_had_state and cached_snapshot_hint?(command.intent)
      target_slot = SaveSlots.switch_player_to_slot(player, slot_index, now)
      clear_commands_after_save_boundary!(player.id, command.sequence, now)

      result =
        %{
          "type" => "save_slot.switch.result",
          "status" => "ok",
          "command_id" => command.command_id,
          "server_time" => Time.iso8601(now),
          "active_save_slot" => target_slot.slot_index,
          "save_slot" => Incrementalist.Game.State.summary(target_slot, target_slot.slot_index),
          "slots" => SaveSlots.summaries(player.id, target_slot.slot_index)
        }
        |> maybe_put_snapshot(target_slot, now, use_cached_snapshot)

      {"succeeded", result, target_slot.id}
    else
      {:error, reason} ->
        {"failed",
         error_result(reason, command, %{
           "active_save_slot" => active_slot.slot_index
         }), active_slot.id}
    end
  end

  defp execute_reset(%Player{} = player, %GameCommand{} = command, now) do
    active_slot = active_slot(player, now)
    reset_slot = SaveSlots.reset(active_slot, now)
    clear_commands_after_save_boundary!(player.id, command.sequence, now)

    {"succeeded",
     %{
       "type" => "save_slot.reset.result",
       "status" => "ok",
       "command_id" => command.command_id,
       "server_time" => Time.iso8601(now),
       "snapshot" => Snapshots.full(reset_slot, reset_slot.slot_index, now),
       "slots" => SaveSlots.summaries(player.id, reset_slot.slot_index)
     }, reset_slot.id}
  end

  defp active_slot(player, now) do
    # Boot must never trust a stale active pointer; reloading ensures we have
    # the latest sequence and state from the database.
    player = Repo.get!(Player, player.id)
    slot = SaveSlots.determine_active_slot(player, now)

    if slot && slot.state do
      new_state = State.check_daily_reset(slot.state, now)

      if new_state != slot.state do
        update_active_slot(slot, %{state: new_state, last_saved_at: now})
      else
        slot
      end
    else
      slot
    end
  end

  defp clear_commands_after_save_boundary!(player_id, boundary_sequence, now) do
    Repo.update_all(
      from(command in GameCommand,
        where:
          command.player_id == ^player_id and command.sequence > ^boundary_sequence and
            command.status == "queued" and is_nil(command.acked_at)
      ),
      set: [status: "acked", acked_at: now]
    )
  end

  defp fetch_slot_index(%{"slot_index" => slot_index}), do: normalize_slot_index(slot_index)
  defp fetch_slot_index(%{slot_index: slot_index}), do: normalize_slot_index(slot_index)
  defp fetch_slot_index(_intent), do: {:error, "slot_index_required"}

  defp fetch_area_key(%{"area" => area}) when is_binary(area), do: {:ok, area}
  defp fetch_area_key(%{area: area}) when is_binary(area), do: {:ok, area}
  defp fetch_area_key(_intent), do: {:error, "area_required"}

  defp fetch_item_id(%{"item_id" => item_id}) when is_binary(item_id), do: {:ok, item_id}
  defp fetch_item_id(%{item_id: item_id}) when is_binary(item_id), do: {:ok, item_id}
  defp fetch_item_id(_intent), do: {:error, "item_id_required"}

  defp fetch_tier_id(%{"tier_id" => tier_id}) when is_binary(tier_id),
    do: validate_tier_id(tier_id)

  defp fetch_tier_id(%{tier_id: tier_id}) when is_binary(tier_id), do: validate_tier_id(tier_id)
  defp fetch_tier_id(_intent), do: {:error, "tier_id_required"}

  defp validate_tier_id(tier_id) do
    if Sisu.tier?(tier_id) do
      {:ok, tier_id}
    else
      {:error, "unknown_tier"}
    end
  end

  defp fetch_leaf_id(%{"leaf_id" => id}) when is_binary(id), do: {:ok, id}
  defp fetch_leaf_id(%{leaf_id: id}) when is_binary(id), do: {:ok, id}
  defp fetch_leaf_id(_intent), do: {:error, "leaf_id_required"}

  defp fetch_notice_event_kind(%{"event" => event}) when is_binary(event),
    do: normalize_notice_event_kind(event)

  defp fetch_notice_event_kind(%{event: event}) when is_binary(event),
    do: normalize_notice_event_kind(event)

  defp fetch_notice_event_kind(_intent), do: {:error, "notice_event_required"}

  defp normalize_notice_event_kind("child_shown"), do: {:ok, :child_shown}
  defp normalize_notice_event_kind("child_clicked"), do: {:ok, :child_clicked}
  defp normalize_notice_event_kind(_), do: {:error, "invalid_notice_event"}

  defp fetch_boolean(intent, key) do
    case Map.get(intent, key) do
      val when is_boolean(val) -> {:ok, val}
      _ -> {:error, "#{key}_boolean_required"}
    end
  end

  defp fetch_quest_id(%{"quest_id" => quest_id}) when is_binary(quest_id), do: {:ok, quest_id}
  defp fetch_quest_id(%{quest_id: quest_id}) when is_binary(quest_id), do: {:ok, quest_id}
  defp fetch_quest_id(_intent), do: {:error, "quest_id_required"}

  defp fetch_screen_id(%{"screen_id" => screen_id}) when is_binary(screen_id),
    do: validate_screen_id(screen_id)

  defp fetch_screen_id(%{screen_id: screen_id}) when is_binary(screen_id),
    do: validate_screen_id(screen_id)

  defp fetch_screen_id(_intent), do: {:error, "screen_id_required"}

  defp validate_screen_id(screen_id) when screen_id in ["stats", "quests", "achievements"],
    do: {:ok, screen_id}

  defp validate_screen_id(_), do: {:error, "unknown_screen"}

  defp normalize_slot_index(slot_index)
       when is_integer(slot_index) do
    if slot_index in Constants.valid_slot_indexes() do
      {:ok, slot_index}
    else
      {:error, "invalid_slot_index"}
    end
  end

  defp normalize_slot_index(slot_index) when is_binary(slot_index) do
    with {integer, ""} <- Integer.parse(slot_index),
         true <- integer in Constants.valid_slot_indexes() do
      {:ok, integer}
    else
      _ -> {:error, "invalid_slot_index"}
    end
  end

  defp normalize_slot_index(_slot_index), do: {:error, "invalid_slot_index"}

  defp fetch_game_id(%{"game" => game_id}) when is_binary(game_id), do: {:ok, game_id}
  defp fetch_game_id(%{game: game_id}) when is_binary(game_id), do: {:ok, game_id}
  defp fetch_game_id(_), do: {:error, "game_id_required"}

  defp cached_snapshot_hint?(%{"has_cached_snapshot" => true}), do: true
  defp cached_snapshot_hint?(%{has_cached_snapshot: true}), do: true
  defp cached_snapshot_hint?(_intent), do: false

  defp maybe_put_snapshot(result, _target_slot, _now, true), do: result

  defp maybe_put_snapshot(result, target_slot, now, false) do
    Map.put(result, "snapshot", Snapshots.full(target_slot, target_slot.slot_index, now))
  end

  defp error_result(reason, command, extra \\ %{}) do
    extra
    |> Map.merge(%{
      "type" => "command.error",
      "status" => "error",
      "command_id" => command.command_id,
      "reason" => to_string(reason)
    })
  end

  defp update_active_slot(slot, attrs) do
    has_daily_token = 
      if Map.has_key?(attrs, :state) do
        SaveSlot.extract_state_tokens(attrs.state)
      else
        attrs[:has_daily_token] || slot.has_daily_token
      end

    attrs = Map.put(attrs, :has_daily_token, has_daily_token)
    
    # Standard update
    updated_slot = Repo.update!(SaveSlot.changeset(slot, attrs))

    # HAMMER: Force the column update. No more excuses.
    import Ecto.Query
    _ = from(s in SaveSlot, where: s.id == ^slot.id) 
        |> Repo.update_all(set: [has_daily_token: has_daily_token])
    
    updated_slot
  end
end
