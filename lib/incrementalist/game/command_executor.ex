defmodule Incrementalist.Game.CommandExecutor do
  @moduledoc """
  Decouples the business logic for executing gameplay commands from the queue
  persistence.

  It maps a `command_type` to game changes, processing the command intent and
  the current state, and applying changes to the database.
  """

  alias Incrementalist.Game.Persistence.{GameCommand, Player, PlayerState, PlayerStates}
  alias Incrementalist.Game.{Notices, Snapshots, State, Time}
  alias Incrementalist.Game.Features.Progress.{Bar, Sisu}
  alias Incrementalist.Game.Features.Quests.Rules, as: Quests
  alias Incrementalist.Game.Features.Achievements.Rules, as: Achievements
  alias Incrementalist.Game.Features.BonusTime.Rules, as: BonusTime
  alias Incrementalist.Game.Features.BonusTime.Games.ChestDraw
  alias Incrementalist.Game.Features.BonusTime.Games.PrizeWheel
  alias Incrementalist.Game.Features.BonusTime.Games.Checklist
  alias Incrementalist.Repo
  import Ecto.Query

  @doc """
  Executes the game rules for a specific command.

  Returns a tuple `{status, result, player_state_id}` to be recorded by the queue manager.
  """
  def execute(%GameCommand{} = command, %Player{} = player, now) do
    # The tuple captures the execution boundary: queue status, replayable client
    # payload, and the player state affected by the command.
    case command.command_type do
      "game.noop" ->
        ps = player_state(player, now)

        {"succeeded",
         %{
           "type" => "game.noop.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "server_time" => Time.iso8601(now),
           "events" => []
         }, ps.id}

      "progress.claim_in" ->
        ps = player_state(player, now)
        {next_state, can_claim_in} = Bar.ensure_can_claim_at(ps.state, now)

        next_notices =
          Notices.refresh_for_state_transition(
            ps.notices || Notices.new(ps.state),
            ps.state,
            next_state
          )

        if next_state != ps.state or next_notices != ps.notices do
          update_player_state(ps, %{
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
         ), ps.id}

      "progress.claim_reward" ->
        ps = player_state(player, now)
        {scheduled_state, can_claim_in} = Bar.ensure_can_claim_at(ps.state, now)

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
              ps.notices || Notices.new(ps.state),
              ps.state,
              new_state
            )

          update_player_state(ps, %{
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
           }, ps.id}
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
           }, ps.id}
        end

      "game.reset" ->
        ps = player_state(player, now)
        reset_ps = PlayerStates.reset(ps, now)
        clear_commands_after_reset!(player.id, command.sequence, now)

        {"succeeded",
         %{
           "type" => "game.reset.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "server_time" => Time.iso8601(now),
           "snapshot" => Snapshots.full(reset_ps, now)
         }, reset_ps.id}

      "area.select" ->
        ps = player_state(player, now)

        with {:ok, area_key} <- fetch_area_key(command.intent),
             {:ok, next_state} <-
               Incrementalist.Game.Features.Areas.select_area(ps.state, area_key) do
          next_notices =
            Notices.refresh_for_state_transition(
              ps.notices || Notices.new(ps.state),
              ps.state,
              next_state
            )

          update_player_state(ps, %{
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
           }, ps.id}
        else
          {:error, reason} ->
            {"failed",
             error_result(reason, command, %{
               "can_claim_at" => ps.state.can_claim_at
             }), ps.id}
        end

      "progress.set_idle_mode" ->
        ps = player_state(player, now)

        with {:ok, enabled} <- fetch_boolean(command.intent, "enabled"),
             {:ok, intermediate_state} <- Bar.set_idle_mode(ps.state, enabled) do
          # TODO: Looks like we can remove the old, unused _can_claim_in from here
          {next_state, _can_claim_in} = Bar.ensure_can_claim_at(intermediate_state, now)

          next_notices =
            Notices.refresh_for_state_transition(
              ps.notices || Notices.new(ps.state),
              ps.state,
              next_state
            )

          update_player_state(ps, %{
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
           ), ps.id}
        else
          {:error, reason} ->
            {"failed",
             error_result(reason, command, %{
               "can_claim_at" => ps.state.can_claim_at
             }), ps.id}
        end

      "sisu.refill" ->
        ps = player_state(player, now)

        with {:ok, tier_id} <- fetch_tier_id(command.intent),
             {:ok, next_state} <- Sisu.refill(ps.state, tier_id, now) do
          next_state = Achievements.evaluate(next_state)

          next_notices =
            Notices.refresh_for_state_transition(
              ps.notices || Notices.new(ps.state),
              ps.state,
              next_state
            )

          update_player_state(ps, %{
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
           ), ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "sisu.upgrade_max" ->
        ps = player_state(player, now)

        with {:ok, next_state} <- Sisu.upgrade_max(ps.state, now) do
          next_state = Achievements.evaluate(next_state)

          next_notices =
            Notices.refresh_for_state_transition(
              ps.notices || Notices.new(ps.state),
              ps.state,
              next_state
            )

          update_player_state(ps, %{
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
           ), ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "shop.purchase" ->
        ps = player_state(player, now)

        with {:ok, item_id} <- fetch_item_id(command.intent),
             {:ok, intermediate_state} <-
               Incrementalist.Game.Features.Shop.purchase(ps.state, item_id) do
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
              ps.notices || Notices.new(ps.state),
              ps.state,
              next_state
            )

          update_player_state(ps, %{
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
           ), ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "notice.event" ->
        ps = player_state(player, now)

        with {:ok, event_kind} <- fetch_notice_event_kind(command.intent),
             {:ok, leaf_id} <- fetch_leaf_id(command.intent),
             true <- Notices.valid_event_kind?(event_kind),
             true <- Notices.valid_leaf_id?(leaf_id) do
          next_notices =
            Notices.apply_event(
              ps.notices || Notices.new(ps.state),
              event_kind,
              leaf_id
            )

          update_player_state(ps, %{notices: next_notices, last_saved_at: now})

          {"succeeded",
           %{
             "type" => "notice.event.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "event" => Atom.to_string(event_kind),
             "leaf_id" => leaf_id,
             "notices" => Notices.payload(next_notices)
           }, ps.id}
        else
          false ->
            {"failed", error_result("invalid_notice_event", command), ps.id}

          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "quest.claim" ->
        ps = player_state(player, now)

        with {:ok, quest_id} <- fetch_quest_id(command.intent),
             {:ok, next_state} <- Quests.claim(ps.state, quest_id) do
          next_state = Achievements.evaluate(next_state)

          next_notices =
            Notices.refresh_for_state_transition(
              ps.notices || Notices.new(ps.state),
              ps.state,
              next_state
            )

          update_player_state(ps, %{
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
           ), ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "stats.mark_viewed" ->
        ps = player_state(player, now)

        with {:ok, screen_id} <- fetch_screen_id(command.intent) do
          new_stats =
            case screen_id do
              "stats" -> %{ps.state.stats | screens_viewed_stats: true}
              "quests" -> %{ps.state.stats | screens_viewed_quests: true}
              "achievements" -> %{ps.state.stats | screens_viewed_achievements: true}
              _ -> ps.state.stats
            end

          next_state = %{ps.state | stats: new_stats} |> Achievements.evaluate()

          next_notices =
            if screen_id == "achievements" do
              unlocked_leaf_ids =
                next_state.achievements
                |> Map.keys()
                |> Enum.map(&Notices.leaf_achievement_id/1)

              current_notices = ps.notices || Notices.new(ps.state)
              updated_seen = Enum.uniq(current_notices.seen_leaf_ids ++ unlocked_leaf_ids)
              notices_with_seen = %{current_notices | seen_leaf_ids: updated_seen}
              Notices.refresh_for_state_transition(notices_with_seen, ps.state, next_state)
            else
              Notices.refresh_for_state_transition(
                ps.notices || Notices.new(ps.state),
                ps.state,
                next_state
              )
            end

          update_player_state(ps, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           %{
             "type" => "stats.update.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "stats" => next_state.stats,
             "achievements" => State.visible_achievements(next_state.achievements),
             "notices" => Notices.payload(next_notices)
           }, ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "stats.graduate_tutorial" ->
        ps = player_state(player, now)
        new_stats = %{ps.state.stats | tutorial_graduated: true}
        next_state = %{ps.state | stats: new_stats} |> Achievements.evaluate()

        if next_state != ps.state do
          update_player_state(ps, %{state: next_state, last_saved_at: now})
        end

        {"succeeded",
         %{
           "type" => "stats.update.result",
           "status" => "ok",
           "command_id" => command.command_id,
           "stats" => next_state.stats,
           "achievements" => State.visible_achievements(next_state.achievements),
           "notices" => ps.notices
         }, ps.id}

      "bonustime.play" ->
        ps = player_state(player, now)

        with {:ok, next_state, token_type} <- BonusTime.spend_token(ps.state),
             active_game_id <- BonusTime.get_active_game_id(now),
             {:ok, game_id} <- fetch_game_id(command.intent),
             true <- game_id == active_game_id do
          # Execute game rules
          {tier, rolls, next_state} =
            case game_id do
              "chest_draw" ->
                {t, r} = ChestDraw.roll_reward(next_state.bonustime.streak)
                {t, r, next_state}

              "prize_wheel" ->
                {t, r} = PrizeWheel.roll_reward(next_state.bonustime.streak)
                {t, r, next_state}

              "resource_checklist" ->
                {:ok, updated_state, t, idx} = Checklist.check_off(next_state, "resource")
                {t, [idx], updated_state}

              "item_checklist" ->
                {:ok, updated_state, t, idx} = Checklist.check_off(next_state, "item")
                {t, [idx], updated_state}

              _ ->
                {1, [1], next_state}
            end

          # Apply rewards
          {next_state, reward_amount} =
            Incrementalist.Game.Rewards.grant_bonus_reward(next_state, tier)

          # Update streak and metadata
          next_state = BonusTime.advance_streak(next_state, now)

          bonustime = next_state.bonustime
          new_reward_counts = Map.update(bonustime.reward_counts, "tier_#{tier}", 1, &(&1 + 1))

          last_result = %{
            "game_id" => game_id,
            "tier" => tier,
            "rolls" => rolls,
            "reward_amount" => reward_amount,
            "token_type" => token_type,
            "played_at" => Time.iso8601(now)
          }

          next_bonustime = %{
            bonustime
            | total_games_played: bonustime.total_games_played + 1,
              reward_counts: new_reward_counts,
              last_result: last_result
          }

          next_state = %{next_state | bonustime: next_bonustime}
          next_state = Achievements.evaluate(next_state)

          projected_bonustime =
            Map.merge(Map.from_struct(next_bonustime), %{
              "rotation_anchor" =>
                Incrementalist.Game.Constants.bonustime_rotation_anchor_at() |> Time.iso8601(),
              "active_game_id" => active_game_id
            })

          next_notices =
            Notices.refresh_for_state_transition(
              ps.notices || Notices.new(ps.state),
              ps.state,
              next_state
            )

          update_player_state(ps, %{
            state: next_state,
            notices: next_notices,
            last_saved_at: now
          })

          {"succeeded",
           %{
             "type" => "bonustime.play.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "coins" => next_state.coins,
             "has_bonustime_token" => next_state.has_bonustime_token,
             "bonustime" => projected_bonustime,
             "achievements" => State.visible_achievements(next_state.achievements),
             "notices" => Notices.payload(next_notices)
           }, ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}

          false ->
            {"failed", error_result("game_not_available", command), ps.id}

          _ ->
            {"failed", error_result("invalid_request", command), ps.id}
        end

      _unknown ->
        ps = player_state(player, now)

        {"failed", error_result("unknown_command", command), ps.id}
    end
  end

  defp player_state(player, now) do
    # Reloading ensures we have the latest state from the database.
    player = Repo.get!(Player, player.id)
    ps = PlayerStates.load_or_create(player, now)

    if ps && ps.state do
      new_state = State.check_daily_reset(ps.state, now)

      if new_state != ps.state do
        update_player_state(ps, %{state: new_state, last_saved_at: now})
      else
        ps
      end
    else
      ps
    end
  end

  defp clear_commands_after_reset!(player_id, boundary_sequence, now) do
    Repo.update_all(
      from(command in GameCommand,
        where:
          command.player_id == ^player_id and command.sequence > ^boundary_sequence and
            command.status == "queued" and is_nil(command.acked_at)
      ),
      set: [status: "acked", acked_at: now]
    )
  end

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

  defp fetch_game_id(%{"game" => game_id}) when is_binary(game_id), do: {:ok, game_id}
  defp fetch_game_id(%{game: game_id}) when is_binary(game_id), do: {:ok, game_id}
  defp fetch_game_id(_), do: {:error, "game_id_required"}

  defp error_result(reason, command, extra \\ %{}) do
    extra
    |> Map.merge(%{
      "type" => "command.error",
      "status" => "error",
      "command_id" => command.command_id,
      "reason" => to_string(reason)
    })
  end

  defp update_player_state(ps, attrs) do
    has_bonustime_token =
      if Map.has_key?(attrs, :state) do
        PlayerState.extract_state_tokens(attrs.state)
      else
        attrs[:has_bonustime_token] || ps.has_bonustime_token
      end

    attrs = Map.put(attrs, :has_bonustime_token, has_bonustime_token)

    # Standard update
    updated_ps = Repo.update!(PlayerState.changeset(ps, attrs))

    # HAMMER: Force the column update. No more excuses.
    import Ecto.Query

    _ =
      from(s in PlayerState, where: s.id == ^ps.id)
      |> Repo.update_all(set: [has_bonustime_token: has_bonustime_token])

    updated_ps
  end
end
