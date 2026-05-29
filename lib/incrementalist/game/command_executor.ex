defmodule Incrementalist.Game.CommandExecutor do
  @moduledoc """
  Decouples the business logic for executing gameplay commands from the queue
  persistence.

  It maps a `command_type` to game changes, processing the command intent and
  the current state, and applying changes to the database.
  """

  alias Incrementalist.Game.Persistence.{GameCommand, Player, PlayerState, PlayerStates}
  alias Incrementalist.Game.{Constants, Notices, Snapshots, State, Time}
  alias Incrementalist.Game.Features.Progress.{Bar, Sisu}
  alias Incrementalist.Game.Features.Orchard.Soil, as: OrchardSoil
  alias Incrementalist.Game.Features.Quests.Rules, as: Quests
  alias Incrementalist.Game.Features.CloverHunt
  alias Incrementalist.Game.Features.Achievements.Rules, as: Achievements
  alias Incrementalist.Game.Features.BonusTime.Rules, as: BonusTime
  alias Incrementalist.Game.Features.BonusTime.Games.ChestDraw
  alias Incrementalist.Game.Features.BonusTime.Games.CoinRain
  alias Incrementalist.Game.Features.BonusTime.Games.PrizeWheel
  alias Incrementalist.Game.Features.BonusTime.Games.Checklist
  alias Incrementalist.Game.Features.BonusTime.Games.PlinkoDrop
  alias Incrementalist.Game.Features.BonusTime.Games.ItsBonusTime
  alias Incrementalist.Game.Features.BonusTime.Games.CardPick
  alias Incrementalist.Game.Features.BonusTime.Games.ScratchCard
  alias Incrementalist.Game.Features.BonusTime.Games.LadderClimb
  alias Incrementalist.Game.Features.BonusTime.Games.RewardLabyrinth
  alias Incrementalist.Game.Features.BonusTime.Games.LuckyDice
  alias Incrementalist.Game.Features.BonusTime.Games.HammerSmash
  alias Incrementalist.Game.Features.BonusTime.JackpotRules
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
             "trust" => new_state.trust,
             "fame" => new_state.fame,
             "required_fame" => new_state.required_fame,
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

      "furnace.upgrade" ->
        ps = player_state(player, now)

        with {:ok, next_state} <- Incrementalist.Game.Features.Areas.upgrade_furnace(ps.state) do
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
             "type" => "furnace.upgrade.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "area" => next_state.area,
             "areas" => Incrementalist.Game.Features.Areas.visible_area_defs(next_state),
             "furnace_level" => next_state.furnace_level,
             "notices" => Notices.payload(next_notices)
           }, ps.id}
        else
          {:error, reason} ->
            {"failed",
             error_result(reason, command, %{
               "can_claim_at" => ps.state.can_claim_at
             }), ps.id}
        end

      "cloverfield.search" ->
        ps = player_state(player, now)

        with {:ok, searched_state, discoveries} <- CloverHunt.search(ps.state) do
          next_state =
            searched_state
            |> Quests.evaluate()
            |> Achievements.evaluate()

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
             "type" => "cloverfield.search.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "discoveries" => discoveries,
             "clover_hunt" => State.CloverHunt.visible_state(next_state.clover_hunt),
             "quests" => State.visible_quests(next_state.quests),
             "achievements" => State.visible_achievements(next_state.achievements),
             "area" => next_state.area,
             "areas" => Incrementalist.Game.Features.Areas.visible_area_defs(next_state),
             "notices" => Notices.payload(next_notices)
           }, ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "cloverfield.confirm_discovery" ->
        ps = player_state(player, now)

        with {:ok, discovery_id} <- fetch_discovery_id(command.intent),
             {:ok, confirmed_state} <- CloverHunt.confirm_discovery(ps.state, discovery_id) do
          next_state =
            confirmed_state
            |> Quests.evaluate()
            |> Achievements.evaluate()

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
             "type" => "cloverfield.confirm_discovery.result",
             "status" => "ok",
             "command_id" => command.command_id,
             "discovery_id" => discovery_id,
             "clover_hunt" => State.CloverHunt.visible_state(next_state.clover_hunt),
             "quests" => State.visible_quests(next_state.quests),
             "achievements" => State.visible_achievements(next_state.achievements),
             "area" => next_state.area,
             "areas" => Incrementalist.Game.Features.Areas.visible_area_defs(next_state),
             "notices" => Notices.payload(next_notices)
           }, ps.id}
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
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
               "trust" => next_state.trust,
               "fame" => next_state.fame,
               "required_fame" => next_state.required_fame,
               "area" => next_state.area,
               "areas" => Incrementalist.Game.Features.Areas.visible_area_defs(next_state),
               "clover_hunt" => State.CloverHunt.visible_state(next_state.clover_hunt),
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

        with {:ok, game_id} <- fetch_game_id(command.intent),
             active_game_id <- BonusTime.get_active_game_id(now),
             true <- game_id == active_game_id do
          intent_map =
            if is_map(command.intent), do: command.intent, else: %{"game_id" => command.intent}

          action = Map.get(intent_map, "action")

          cond do
            game_id == "lucky_dice" ->
              handle_lucky_dice_action(command, ps, intent_map, now, active_game_id)

            game_id == "coin_rain" and action == "claim" ->
              # Step 2: Coin Rain Claim
              active_session = ps.state.bonustime.active_session

              if active_session && active_session.type == "coin_rain" do
                path = Map.get(intent_map, "path", [])
                seed = Map.get(active_session.data, "seed")
                timer = Map.get(active_session.data, "timer")
                bucket_speed = Map.get(active_session.data, "bucket_speed")
                bucket_width = Map.get(active_session.data, "bucket_width")
                token_type = Map.get(active_session.data, "token_type")
                streak = ps.state.bonustime.streak

                {tier, coins_caught} =
                  CoinRain.evaluate_results(path, seed, timer, streak, bucket_speed, bucket_width)

                # Apply reward chest
                {next_state, reward_amount} =
                  Incrementalist.Game.Rewards.grant_bonus_reward(ps.state, tier)

                # Apply normal coins caught
                level = next_state.level
                coins_per_catch = 1000 * level * (1 + streak * 0.05)
                total_coins_to_grant = BigNum.from_number(trunc(coins_caught * coins_per_catch))

                next_state = %{
                  next_state
                  | coins: BigNum.add(next_state.coins, total_coins_to_grant)
                }

                # Update streak and metadata
                next_state = BonusTime.advance_streak(next_state, now)

                bonustime = next_state.bonustime

                new_reward_counts =
                  Map.update(bonustime.reward_counts, "tier_#{tier}", 1, &(&1 + 1))

                last_result =
                  %{
                    "game_id" => game_id,
                    "tier" => tier,
                    "reward_amount" => reward_amount,
                    "token_type" => token_type,
                    "played_at" => Time.iso8601(now),
                    "coins_caught" => coins_caught,
                    "coins_granted" => total_coins_to_grant
                  }

                next_bonustime = %{
                  bonustime
                  | total_games_played: bonustime.total_games_played + 1,
                    reward_counts: new_reward_counts,
                    last_result: last_result,
                    # Clear session
                    active_session: nil
                }

                next_state = %{next_state | bonustime: next_bonustime}
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

                projected_bonustime =
                  projected_bonustime_payload(next_bonustime, active_game_id)

                {"succeeded",
                 %{
                   "type" => "bonustime.play.result",
                   "status" => "ok",
                   "command_id" => command.command_id,
                   "coins" => next_state.coins,
                   "has_bonustime_token" => next_state.has_bonustime_token,
                   "bonustime" => projected_bonustime,
                   "achievements" => State.visible_achievements(next_state.achievements),
                   "notices" => Notices.payload(next_notices),
                   "action" => "claim"
                 }, ps.id}
              else
                {"failed", error_result("no_active_coin_rain_session", command), ps.id}
              end

            game_id == "match_pairs" and action == "claim" ->
              # Step 2: Match Pairs Claim
              active_session = ps.state.bonustime.active_session

              if active_session && active_session.type == "match_pairs" do
                discarded = Map.get(intent_map, "discarded", [])
                rolled_results = Map.get(active_session.data, "results", [])
                token_type = Map.get(active_session.data, "token_type")

                completed_matches =
                  Incrementalist.Game.Features.BonusTime.Games.MatchPairs.evaluate_claim(
                    rolled_results,
                    discarded
                  )

                reward_tiers =
                  Incrementalist.Game.Features.BonusTime.Games.MatchPairs.claim_reward_tiers(
                    completed_matches
                  )

                reward_tier =
                  Incrementalist.Game.Features.BonusTime.Games.MatchPairs.claim_reward_tier(
                    completed_matches
                  )

                # Apply rewards for each completed match
                {next_state, reward_amount} =
                  Enum.reduce(reward_tiers, {ps.state, BigNum.zero()}, fn tier,
                                                                          {state_acc, amount_acc} ->
                    {next_state_acc, amt} =
                      Incrementalist.Game.Rewards.grant_bonus_reward(state_acc, tier)

                    {next_state_acc, BigNum.add(amount_acc, amt)}
                  end)

                # Update streak and metadata
                next_state = BonusTime.advance_streak(next_state, now)

                bonustime = next_state.bonustime

                new_reward_counts =
                  Enum.reduce(reward_tiers, bonustime.reward_counts, fn tier, acc ->
                    Map.update(acc, "tier_#{tier}", 1, &(&1 + 1))
                  end)

                last_result =
                  %{
                    "game_id" => game_id,
                    "completed_matches" => completed_matches,
                    "discarded_tiers" => discarded,
                    "tier" => reward_tier,
                    "reward_amount" => reward_amount,
                    "token_type" => token_type,
                    "played_at" => Time.iso8601(now)
                  }

                next_bonustime = %{
                  bonustime
                  | total_games_played: bonustime.total_games_played + 1,
                    reward_counts: new_reward_counts,
                    last_result: last_result,
                    # Clear session
                    active_session: nil
                }

                next_state = %{next_state | bonustime: next_bonustime}
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

                projected_bonustime =
                  projected_bonustime_payload(next_bonustime, active_game_id)

                {"succeeded",
                 %{
                   "type" => "bonustime.play.result",
                   "status" => "ok",
                   "command_id" => command.command_id,
                   "coins" => next_state.coins,
                   "shards" => next_state.shards,
                   "cores" => next_state.cores,
                   "has_bonustime_token" => next_state.has_bonustime_token,
                   "bonustime" => projected_bonustime,
                   "achievements" => State.visible_achievements(next_state.achievements),
                   "notices" => Notices.payload(next_notices),
                   "action" => "claim"
                 }, ps.id}
              else
                {"failed", error_result("no_active_match_pairs_session", command), ps.id}
              end

            true ->
              # Standard single-step play OR Step 1 of Coin Rain / Match Pairs
              with {:ok, next_state, token_type} <-
                     BonusTime.spend_token_for_game(ps.state, game_id, now) do
                next_state =
                  if token_type == "daily" do
                    new_bonustime = %{
                      next_state.bonustime
                      | bonustime_flips: next_state.bonustime.bonustime_flips + 1
                    }

                    %{next_state | bonustime: new_bonustime}
                  else
                    next_state
                  end

                if game_id in ["coin_rain", "match_pairs"] do
                  # Step 1: Start Coin Rain or Match Pairs
                  session_params =
                    case game_id do
                      "coin_rain" ->
                        Incrementalist.Game.Features.BonusTime.Games.CoinRain.generate_session(
                          next_state.bonustime.streak
                        )

                      "match_pairs" ->
                        Incrementalist.Game.Features.BonusTime.Games.MatchPairs.generate_session(
                          next_state.bonustime.streak
                        )
                    end

                  active_session = %State.ActiveSession{
                    type: game_id,
                    data:
                      Map.merge(session_params, %{
                        "token_type" => token_type,
                        "started_at" => Time.iso8601(now)
                      })
                  }

                  next_bonustime = %{next_state.bonustime | active_session: active_session}
                  next_state = %{next_state | bonustime: next_bonustime}

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

                  projected_bonustime =
                    projected_bonustime_payload(next_bonustime, active_game_id)

                  {"succeeded",
                   %{
                     "type" => "bonustime.play.result",
                     "status" => "ok",
                     "command_id" => command.command_id,
                     "coins" => next_state.coins,
                     "has_bonustime_token" => next_state.has_bonustime_token,
                     "bonustime" => projected_bonustime,
                     "achievements" => State.visible_achievements(next_state.achievements),
                     "notices" => Notices.payload(next_notices),
                     "action" => "start",
                     "session" => session_params
                   }, ps.id}
                else
                  # Single-step games (Chest Draw, Plinko, Checklist, Jackpot, etc.)
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

                      "plinko_drop" ->
                        {t, rolls, plinko} = PlinkoDrop.roll_reward(next_state.bonustime.streak)
                        {t, %{"rolls" => rolls, "plinko" => plinko}, next_state}

                      "jackpot_meter" ->
                        {:ok, updated_state, t, progress} = JackpotRules.play(next_state)
                        {t, [progress], updated_state}

                      "its_bonus_time" ->
                        {flips, board_tiers} =
                          ItsBonusTime.roll_reward(
                            next_state.bonustime.streak,
                            next_state.bonustime.bonustime_flips,
                            now
                          )

                        # Extract first `flips` tiles (claimed rewards)
                        claimed_tiers = Enum.take(board_tiers, flips)
                        best_tier = Enum.max(claimed_tiers)

                        # Delete exactly one occurrence of best_tier to let outer block apply it
                        other_tiers = delete_one(claimed_tiers, best_tier)

                        # Update reward_counts for other_tiers first
                        updated_reward_counts =
                          Enum.reduce(other_tiers, next_state.bonustime.reward_counts, fn t,
                                                                                          acc ->
                            Map.update(acc, "tier_#{t}", 1, &(&1 + 1))
                          end)

                        next_bonustime = %{
                          next_state.bonustime
                          | reward_counts: updated_reward_counts
                        }

                        next_state = %{next_state | bonustime: next_bonustime}

                        # Apply rewards for other_tiers
                        {next_state, coins_others} =
                          Enum.reduce(other_tiers, {next_state, BigNum.zero()}, fn t,
                                                                                   {state_acc,
                                                                                    coins_acc} ->
                            {next_state_acc, reward_coins} =
                              Incrementalist.Game.Rewards.grant_bonus_reward(state_acc, t)

                            {next_state_acc, BigNum.add(coins_acc, reward_coins)}
                          end)

                        {best_tier,
                         %{
                           "board" => board_tiers,
                           "flips" => flips,
                           "claimed_tiers" => claimed_tiers,
                           "coins_others" => coins_others
                         }, next_state}

                      "card_pick" ->
                        {total_picks, final_board} =
                          CardPick.roll_reward(
                            next_state.bonustime.streak,
                            next_state.bonustime.bonustime_flips,
                            now
                          )

                        claimed_cards = Enum.take(final_board, total_picks)
                        best_card = Enum.max_by(claimed_cards, fn c -> c.tier end)
                        best_tier = best_card.tier

                        other_cards = delete_one_card(claimed_cards, best_card)

                        # Update reward_counts for other_cards
                        updated_reward_counts =
                          Enum.reduce(other_cards, next_state.bonustime.reward_counts, fn c,
                                                                                          acc ->
                            Map.update(acc, "tier_#{c.tier}", 1, &(&1 + 1))
                          end)

                        next_bonustime = %{
                          next_state.bonustime
                          | reward_counts: updated_reward_counts
                        }

                        next_state = %{next_state | bonustime: next_bonustime}

                        # Apply rewards for other_cards with multipliers
                        {next_state, coins_others} =
                          Enum.reduce(other_cards, {next_state, BigNum.zero()}, fn card,
                                                                                   {state_acc,
                                                                                    coins_acc} ->
                            {next_state_acc, base_coins} =
                              Incrementalist.Game.Rewards.grant_bonus_reward(state_acc, card.tier)

                            multiplied_coins =
                              BigNum.mul(base_coins, BigNum.from_number(card.multiplier))

                            reward_remainder =
                              BigNum.mul(base_coins, BigNum.from_number(card.multiplier - 1))

                            next_state_acc = %{
                              next_state_acc
                              | coins: BigNum.add(next_state_acc.coins, reward_remainder),
                                stats: %{
                                  next_state_acc.stats
                                  | total_coins_earned:
                                      BigNum.add(
                                        next_state_acc.stats.total_coins_earned,
                                        reward_remainder
                                      )
                                }
                            }

                            {next_state_acc, BigNum.add(coins_acc, multiplied_coins)}
                          end)

                        # Calculate multiplier remainder for best_card and grant it
                        {_, best_card_base_coins} =
                          Incrementalist.Game.Rewards.grant_bonus_reward(next_state, best_tier)

                        best_remainder =
                          BigNum.mul(
                            best_card_base_coins,
                            BigNum.from_number(best_card.multiplier - 1)
                          )

                        next_state = %{
                          next_state
                          | coins: BigNum.add(next_state.coins, best_remainder),
                            stats: %{
                              next_state.stats
                              | total_coins_earned:
                                  BigNum.add(next_state.stats.total_coins_earned, best_remainder)
                            }
                        }

                        {best_tier,
                         %{
                           "board" =>
                             Enum.map(final_board, fn c ->
                               %{"tier" => c.tier, "multiplier" => c.multiplier}
                             end),
                           "flips" => total_picks,
                           "coins_others" => BigNum.add(coins_others, best_remainder)
                         }, next_state}

                      "scratch_card" ->
                        {pixels_budget, reveal_schedule} =
                          ScratchCard.roll_reward(
                            next_state.bonustime.streak,
                            next_state.bonustime.bonustime_flips,
                            now
                          )

                        best_reveal = Enum.max_by(reveal_schedule, fn reveal -> reveal.tier end)
                        best_tier = best_reveal.tier
                        other_reveals = delete_one(reveal_schedule, best_reveal)

                        # Update reward_counts for non-primary rewards first.
                        updated_reward_counts =
                          Enum.reduce(
                            other_reveals,
                            next_state.bonustime.reward_counts,
                            fn reveal, acc ->
                              Map.update(acc, "tier_#{reveal.tier}", 1, &(&1 + 1))
                            end
                          )

                        next_bonustime = %{
                          next_state.bonustime
                          | reward_counts: updated_reward_counts
                        }

                        next_state = %{next_state | bonustime: next_bonustime}

                        # Apply non-primary rewards before the best reward.
                        {next_state, coins_others} =
                          Enum.reduce(other_reveals, {next_state, BigNum.zero()}, fn reveal,
                                                                                     {state_acc,
                                                                                      coins_acc} ->
                            {next_state_acc, base_coins} =
                              Incrementalist.Game.Rewards.grant_bonus_reward(
                                state_acc,
                                reveal.tier
                              )

                            {next_state_acc, BigNum.add(coins_acc, base_coins)}
                          end)

                        {best_tier,
                         %{
                           "pixels_budget" => pixels_budget,
                           "reveal_schedule" =>
                             Enum.map(reveal_schedule, fn reveal ->
                               %{"pixels" => reveal.pixels, "tier" => reveal.tier}
                             end),
                           "coins_others" => coins_others
                         }, next_state}

                      "ladder_climb" ->
                        {reward_tier, path} =
                          LadderClimb.roll_reward(
                            next_state.bonustime.streak,
                            next_state.bonustime.bonustime_flips,
                            now
                          )

                        {reward_tier, path, next_state}

                      "reward_labyrinth" ->
                        {steps_total, chests} =
                          RewardLabyrinth.roll_reward(
                            next_state.bonustime.streak,
                            next_state.bonustime.bonustime_flips,
                            now
                          )

                        best_chest = Enum.max_by(chests, fn c -> c.tier end)
                        best_tier = best_chest.tier

                        other_chests = delete_one_chest(chests, best_chest)

                        # Update reward_counts for other_chests
                        updated_reward_counts =
                          Enum.reduce(other_chests, next_state.bonustime.reward_counts, fn c,
                                                                                           acc ->
                            Map.update(acc, "tier_#{c.tier}", 1, &(&1 + 1))
                          end)

                        next_bonustime = %{
                          next_state.bonustime
                          | reward_counts: updated_reward_counts
                        }

                        next_state = %{next_state | bonustime: next_bonustime}

                        # Apply rewards for other_chests
                        {next_state, coins_others} =
                          Enum.reduce(other_chests, {next_state, BigNum.zero()}, fn chest,
                                                                                    {state_acc,
                                                                                     coins_acc} ->
                            {next_state_acc, base_coins} =
                              Incrementalist.Game.Rewards.grant_bonus_reward(
                                state_acc,
                                chest.tier
                              )

                            {next_state_acc, BigNum.add(coins_acc, base_coins)}
                          end)

                        {best_tier,
                         %{
                           "chests" =>
                             Enum.map(chests, fn c -> %{"step" => c.step, "tier" => c.tier} end),
                           "steps_total" => steps_total,
                           "coins_others" => coins_others
                         }, next_state}

                      "hammer_smash" ->
                        {best_tier, smash_result} =
                          HammerSmash.roll_reward(next_state.bonustime.streak)

                        bell_extra_tier = smash_result["bell_extra_tier"]

                        if bell_extra_tier do
                          # Bell hit: base is tier_6, extra is bell_extra_tier
                          # Grant tier_6 as "other" reward, best_tier = bell_extra_tier
                          {base_grant_state, base_coins} =
                            Incrementalist.Game.Rewards.grant_bonus_reward(next_state, 6)

                          updated_reward_counts =
                            Map.update(
                              base_grant_state.bonustime.reward_counts,
                              "tier_6",
                              1,
                              &(&1 + 1)
                            )

                          next_bonustime = %{
                            base_grant_state.bonustime
                            | reward_counts: updated_reward_counts
                          }

                          base_grant_state = %{base_grant_state | bonustime: next_bonustime}

                          {bell_extra_tier,
                           %{"smashes" => smash_result, "coins_others" => base_coins},
                           base_grant_state}
                        else
                          {best_tier, smash_result, next_state}
                        end

                      _ ->
                        {1, [1], next_state}
                    end

                  # Apply rewards
                  {next_state, reward_amount} =
                    Incrementalist.Game.Rewards.grant_bonus_reward(next_state, tier)

                  # Update streak and metadata
                  next_state = BonusTime.advance_streak(next_state, now)

                  bonustime = next_state.bonustime

                  new_reward_counts =
                    Map.update(bonustime.reward_counts, "tier_#{tier}", 1, &(&1 + 1))

                  last_result =
                    %{
                      "game_id" => game_id,
                      "tier" => tier,
                      "rolls" => if(is_map(rolls), do: rolls["rolls"], else: rolls),
                      "reward_amount" => reward_amount,
                      "token_type" => token_type,
                      "played_at" => Time.iso8601(now)
                    }
                    |> maybe_put_plinko_payload(rolls)
                    |> maybe_adjust_its_bonus_time_result(rolls)
                    |> maybe_adjust_card_pick_result(rolls)
                    |> maybe_adjust_scratch_card_result(rolls)
                    |> maybe_adjust_reward_labyrinth_result(rolls)
                    |> maybe_adjust_hammer_smash_result(rolls)

                  next_bonustime = %{
                    bonustime
                    | total_games_played: bonustime.total_games_played + 1,
                      reward_counts: new_reward_counts,
                      last_result: last_result
                  }

                  next_state = %{next_state | bonustime: next_bonustime}
                  next_state = Achievements.evaluate(next_state)

                  projected_bonustime =
                    projected_bonustime_payload(next_bonustime, active_game_id)

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
                end
              end
          end
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}

          false ->
            {"failed", error_result("game_not_available", command), ps.id}

          _ ->
            {"failed", error_result("invalid_request", command), ps.id}
        end

      "orchard.unlock_plot" ->
        ps = player_state(player, now)

        with {:ok, plot_id} <- fetch_plot_id(command.intent),
             {:ok, plot_index} <- parse_plot_index(plot_id) do
          if plot_id in ps.state.unlocked_plots do
            {"failed", error_result("already_unlocked", command), ps.id}
          else
            price_shards = plot_index * 100
            price_bn = BigNum.from_number(price_shards)

            if BigNum.compare(ps.state.shards, price_bn) >= 0 do
              next_shards = BigNum.sub(ps.state.shards, price_bn)

              next_plots =
                if Enum.any?(ps.state.plots, &(&1.id == plot_id)) do
                  ps.state.plots
                else
                  [%State.Plot{id: plot_id, depth: 1} | ps.state.plots]
                end

              next_unlocked =
                if plot_id in ps.state.unlocked_plots do
                  ps.state.unlocked_plots
                else
                  [plot_id | ps.state.unlocked_plots]
                end

              next_state = %{
                ps.state
                | shards: next_shards,
                  plots: next_plots,
                  unlocked_plots: next_unlocked
              }
              |> Quests.evaluate()
              |> Achievements.evaluate()

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
                 "type" => "orchard.unlock_plot.result",
                 "status" => "ok",
                 "command_id" => command.command_id,
                 "plot_id" => plot_id,
                 "shards" => next_state.shards,
                 "unlocked_plots" => next_state.unlocked_plots,
                 "plots" => State.visible_plots(next_state.plots),
                 "notices" => Notices.payload(next_notices)
               }, ps.id}
            else
              {"failed", error_result("insufficient_shards", command), ps.id}
            end
          end
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "orchard.plant_seed" ->
        ps = player_state(player, now)

        with {:ok, plot_id} <- fetch_plot_id(command.intent),
             {:ok, seed_id} <- fetch_seed_id(command.intent) do
          
          plot = Enum.find(ps.state.plots, &(&1.id == plot_id))
          spec = Map.get(Constants.orchard_defs()["plants"] || %{}, seed_id)

          cond do
            not (plot_id in ps.state.unlocked_plots) ->
              {"failed", error_result("plot_locked", command), ps.id}

            is_nil(plot) ->
              {"failed", error_result("plot_locked", command), ps.id}

            not is_nil(plot.plant) or not is_nil(plot.decomposition) ->
              {"failed", error_result("plot_occupied", command), ps.id}

            is_nil(spec) ->
              {"failed", error_result("unknown_seed", command), ps.id}

            true ->
              current_seeds = get_seed_inventory(ps.state, seed_id)

              seeds_to_plant = normalize_big_num(spec["seedsToPlant"])
              min_organic = BigNum.from_number(spec["minOrganic"] || 0.0)
              min_depth = spec["minDepth"] || 0

              soil = ps.state.soil

              # Nutrient checks
              {next_n, err} =
                case spec["nitrogen"] do
                  %{"min" => min_val} ->
                    min_bn = normalize_big_num(min_val)
                    if BigNum.compare(soil.nitrogen, min_bn) >= 0 do
                      loss = BigNum.from_number(BigNum.to_float(min_bn) * 0.5)
                      {clamp_big_num_non_negative(BigNum.sub(soil.nitrogen, loss)), nil}
                    else
                      {soil.nitrogen, "insufficient_nitrogen"}
                    end
                  _ ->
                    {soil.nitrogen, nil}
                end

              {next_p, err} =
                if is_nil(err) do
                  case spec["phosphorus"] do
                    %{"min" => min_val} ->
                      min_bn = normalize_big_num(min_val)
                      if BigNum.compare(soil.phosphorus, min_bn) >= 0 do
                        loss = BigNum.from_number(BigNum.to_float(min_bn) * 0.5)
                        {clamp_big_num_non_negative(BigNum.sub(soil.phosphorus, loss)), nil}
                      else
                        {soil.phosphorus, "insufficient_phosphorus"}
                      end
                    _ ->
                      {soil.phosphorus, nil}
                  end
                else
                  {soil.phosphorus, err}
                end

              {next_k, err} =
                if is_nil(err) do
                  case spec["potassium"] do
                    %{"min" => min_val} ->
                      min_bn = normalize_big_num(min_val)
                      if BigNum.compare(soil.potassium, min_bn) >= 0 do
                        loss = BigNum.from_number(BigNum.to_float(min_bn) * 0.5)
                        {clamp_big_num_non_negative(BigNum.sub(soil.potassium, loss)), nil}
                      else
                        {soil.potassium, "insufficient_potassium"}
                      end
                    _ ->
                      {soil.potassium, nil}
                  end
                else
                  {soil.potassium, err}
                end

              cond do
                BigNum.compare(current_seeds, seeds_to_plant) < 0 ->
                  {"failed", error_result("insufficient_seeds", command), ps.id}

                BigNum.compare(soil.organic_matter, min_organic) < 0 ->
                  {"failed", error_result("insufficient_organic_matter", command), ps.id}

                plot.depth < min_depth ->
                  {"failed", error_result("insufficient_depth", command), ps.id}

                not is_nil(err) ->
                  {"failed", error_result(err, command), ps.id}

                true ->
                  next_seed_inv = BigNum.sub(current_seeds, seeds_to_plant)
                  
                  next_state = ps.state
                  next_state = update_seed_inventory(next_state, seed_id, next_seed_inv)

                  next_soil = %{soil | nitrogen: next_n, phosphorus: next_p, potassium: next_k}
                  
                  new_plant = %State.Plant{
                    seed_id: seed_id,
                    growth: 0.0,
                    level: 1,
                    planted_at: Time.iso8601(now)
                  }

                  next_plots = Enum.map(next_state.plots, fn
                    p when p.id == plot_id -> %{p | plant: new_plant}
                    p -> p
                  end)

                  next_state = %{next_state | soil: next_soil, plots: next_plots}
                  |> Quests.evaluate()
                  |> Achievements.evaluate()

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
                     "type" => "orchard.plant_seed.result",
                     "status" => "ok",
                     "command_id" => command.command_id,
                     "plot_id" => plot_id,
                     "seed_id" => seed_id,
                     "clover_seeds" => next_state.clover_seeds,
                     "acorns" => next_state.acorns,
                     "coin_tree_seeds" => next_state.coin_tree_seeds,
                     "soil" => OrchardSoil.visible_state(next_state.soil),
                     "plots" => State.visible_plots(next_state.plots),
                     "notices" => Notices.payload(next_notices)
                   }, ps.id}
              end
          end
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "orchard.harvest_plot" ->
        ps = player_state(player, now)

        with {:ok, plot_id} <- fetch_plot_id(command.intent),
             {:ok, action} <- fetch_action(command.intent) do
          
          plot = Enum.find(ps.state.plots, &(&1.id == plot_id))

          cond do
            not (plot_id in ps.state.unlocked_plots) ->
              {"failed", error_result("plot_locked", command), ps.id}

            is_nil(plot) ->
              {"failed", error_result("plot_locked", command), ps.id}

            is_nil(plot.plant) ->
              {"failed", error_result("no_plant_on_plot", command), ps.id}

            plot.plant.growth < 100.0 ->
              {"failed", error_result("plant_not_ready", command), ps.id}

            true ->
              spec = Map.get(Constants.orchard_defs()["plants"] || %{}, plot.plant.seed_id)

              if is_nil(spec) do
                {"failed", error_result("unknown_seed", command), ps.id}
              else
                size_bn = normalize_big_num(spec["size"])
                size_f = BigNum.to_float(size_bn)

                {wood_f, pm_f} =
                  case spec["plantType"] do
                    "tree" -> {size_f * 0.9, size_f * 0.1}
                    "bush" -> {size_f * 0.4, size_f * 0.6}
                    _ -> {0.0, size_f * 1.0} # herbaceous
                  end

                wood_yield = BigNum.from_number(trunc(wood_f))
                pm_yield = BigNum.from_number(trunc(pm_f))

                next_depth = plot.depth + 1

                next_state =
                  if action == "keep" do
                    # Gain materials
                    next_wood = BigNum.add(ps.state.wood, wood_yield)
                    next_pm = BigNum.add(ps.state.plant_matter, pm_yield)

                    # Roll seeds
                    seeds_rolled = roll_weighted(spec["seedAmount"] || %{})
                    seeds_rolled_bn = BigNum.from_number(seeds_rolled)

                    next_state = %{ps.state | wood: next_wood, plant_matter: next_pm}

                    next_state =
                      case spec["seed"] do
                        "clover_seeds" ->
                          %{next_state | clover_seeds: BigNum.add(next_state.clover_seeds, seeds_rolled_bn)}
                        "acorn" ->
                          %{next_state | acorns: BigNum.add(next_state.acorns, seeds_rolled_bn)}
                        "coin_tree_seed" ->
                          %{next_state | coin_tree_seeds: BigNum.add(next_state.coin_tree_seeds, seeds_rolled_bn)}
                        _ ->
                          next_state
                      end

                    # Gained coins if harvestType is resource
                    next_state =
                      if spec["harvestType"] == "resource" do
                        min_coins = normalize_big_num(spec["harvestAmount"]["min"])
                        max_coins = normalize_big_num(spec["harvestAmount"]["max"])
                        min_f = BigNum.to_float(min_coins)
                        max_f = BigNum.to_float(max_coins)
                        coins_rolled = min_f + :rand.uniform() * (max_f - min_f)
                        coins_yield = BigNum.from_number(trunc(coins_rolled))

                        %{next_state |
                          coins: BigNum.add(next_state.coins, coins_yield),
                          stats: %{next_state.stats |
                            total_coins_earned: BigNum.add(next_state.stats.total_coins_earned, coins_yield)
                          }
                        }
                      else
                        next_state
                      end

                    next_plots = Enum.map(next_state.plots, fn
                      p when p.id == plot_id -> %{p | plant: nil, decomposition: nil, depth: next_depth}
                      p -> p
                    end)

                    %{next_state | plots: next_plots}
                  else
                    # action == decompose
                    decomp_resource = if(spec["harvestType"] == "fruit", do: "fruit", else: "plant_matter")
                    new_decomp = %State.Decomposition{
                      resource_id: decomp_resource,
                      amount: pm_yield,
                      progress: 0.0
                    }

                    next_plots = Enum.map(ps.state.plots, fn
                      p when p.id == plot_id -> %{p | plant: nil, decomposition: new_decomp, depth: next_depth}
                      p -> p
                    end)

                    %{ps.state | plots: next_plots}
                  end

                next_state =
                  next_state
                  |> Quests.evaluate()
                  |> Achievements.evaluate()

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
                   "type" => "orchard.harvest_plot.result",
                   "status" => "ok",
                   "command_id" => command.command_id,
                   "plot_id" => plot_id,
                   "action" => action,
                   "wood" => next_state.wood,
                   "plant_matter" => next_state.plant_matter,
                   "ash" => next_state.ash,
                   "charcoal" => next_state.charcoal,
                   "clover_seeds" => next_state.clover_seeds,
                   "acorns" => next_state.acorns,
                   "coin_tree_seeds" => next_state.coin_tree_seeds,
                   "coins" => next_state.coins,
                   "plots" => State.visible_plots(next_state.plots),
                   "notices" => Notices.payload(next_notices)
                 }, ps.id}
              end
          end
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "orchard.splice_seeds" ->
        ps = player_state(player, now)

        with {:ok, seed_a} <- fetch_seed_a(command.intent),
             {:ok, seed_b} <- fetch_seed_b(command.intent) do
          
          splicing_defs = Constants.orchard_defs()["splicing"] || %{}
          matched_recipe =
            Enum.find(splicing_defs, fn {_result_seed, rule} ->
              (rule["seed_a"] == seed_a and rule["seed_b"] == seed_b) or
              (rule["seed_a"] == seed_b and rule["seed_b"] == seed_a)
            end)

          if is_nil(matched_recipe) do
            {"failed", error_result("invalid_splice_recipe", command), ps.id}
          else
            {result_seed_id, rule} = matched_recipe
            cost_gold = normalize_big_num(rule["cost_gold"])

            seeds_a_inv = get_seed_inventory(ps.state, seed_a)
            seeds_b_inv = get_seed_inventory(ps.state, seed_b)

            cond do
              BigNum.compare(ps.state.coins, cost_gold) < 0 ->
                {"failed", error_result("insufficient_gold", command), ps.id}

              BigNum.compare(seeds_a_inv, BigNum.one()) < 0 or BigNum.compare(seeds_b_inv, BigNum.one()) < 0 ->
                {"failed", error_result("insufficient_seeds", command), ps.id}

              true ->
                next_state = ps.state
                next_state = update_seed_inventory(next_state, seed_a, BigNum.sub(seeds_a_inv, BigNum.one()))
                
                # Fetch fresh from next_state in case seed_b was the same
                seeds_b_inv_fresh = get_seed_inventory(next_state, seed_b)
                next_state = update_seed_inventory(next_state, seed_b, BigNum.sub(seeds_b_inv_fresh, BigNum.one()))

                next_coins = BigNum.sub(next_state.coins, cost_gold)
                next_state = %{next_state | coins: next_coins}

                # Chance roll
                roll = :rand.uniform()
                next_state =
                  if roll <= (rule["chance"] || 1.0) do
                    next_spliced = Enum.uniq([result_seed_id | next_state.spliced_seeds])
                    %{next_state | spliced_seeds: next_spliced}
                  else
                    next_state
                  end

                next_state =
                  next_state
                  |> Quests.evaluate()
                  |> Achievements.evaluate()

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
                   "type" => "orchard.splice_seeds.result",
                   "status" => "ok",
                   "command_id" => command.command_id,
                   "spliced_seeds" => next_state.spliced_seeds,
                   "coins" => next_state.coins,
                   "clover_seeds" => next_state.clover_seeds,
                   "acorns" => next_state.acorns,
                   "notices" => Notices.payload(next_notices)
                 }, ps.id}
            end
          end
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      "orchard.buy_seed" ->
        ps = player_state(player, now)

        with {:ok, seed_id} <- fetch_seed_id(command.intent),
             {:ok, amount} <- fetch_amount(command.intent) do
          
          shop_defs = Constants.orchard_defs()["shop"] || %{}
          rule = Map.get(shop_defs, seed_id)

          cond do
            is_nil(rule) ->
              {"failed", error_result("unknown_seed", command), ps.id}

            not (rule["unlocked_by_default"] == true or seed_id in ps.state.spliced_seeds) ->
              {"failed", error_result("seed_locked", command), ps.id}

            true ->
              cost_coins = BigNum.mul(normalize_big_num(rule["cost"]), BigNum.from_number(amount))
              
              cost_shards =
                if rule["cost_shards"] do
                  BigNum.mul(normalize_big_num(rule["cost_shards"]), BigNum.from_number(amount))
                else
                  nil
                end

              cond do
                BigNum.compare(ps.state.coins, cost_coins) < 0 ->
                  {"failed", error_result("insufficient_gold", command), ps.id}

                not is_nil(cost_shards) and BigNum.compare(ps.state.shards, cost_shards) < 0 ->
                  {"failed", error_result("insufficient_shards", command), ps.id}

                true ->
                  next_coins = BigNum.sub(ps.state.coins, cost_coins)
                  next_shards = if is_nil(cost_shards), do: ps.state.shards, else: BigNum.sub(ps.state.shards, cost_shards)

                  seeds_inv = get_seed_inventory(ps.state, seed_id)
                  next_seeds = BigNum.add(seeds_inv, BigNum.from_number(amount))

                  next_state = %{ps.state | coins: next_coins, shards: next_shards}
                  next_state = update_seed_inventory(next_state, seed_id, next_seeds)

                  next_state =
                    next_state
                    |> Quests.evaluate()
                    |> Achievements.evaluate()

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
                     "type" => "orchard.buy_seed.result",
                     "status" => "ok",
                     "command_id" => command.command_id,
                     "seed_id" => seed_id,
                     "amount" => amount,
                     "coins" => next_state.coins,
                     "shards" => next_state.shards,
                     "clover_seeds" => next_state.clover_seeds,
                     "acorns" => next_state.acorns,
                     "coin_tree_seeds" => next_state.coin_tree_seeds,
                     "notices" => Notices.payload(next_notices)
                   }, ps.id}
              end
          end
        else
          {:error, reason} ->
            {"failed", error_result(reason, command), ps.id}
        end

      _unknown ->
        ps = player_state(player, now)

        {"failed", error_result("unknown_command", command), ps.id}
    end
  end

  defp handle_lucky_dice_action(command, ps, intent_map, now, active_game_id) do
    action = Map.get(intent_map, "action") || "throw"
    active_session = ps.state.bonustime.active_session

    cond do
      (action == "throw" and active_session) && active_session.type == "lucky_dice" ->
        with {:ok, held_indexes} <- fetch_held_indexes(intent_map),
             {:ok, next_session_data} <- LuckyDice.throw(active_session.data, held_indexes) do
          next_active_session = %{active_session | data: next_session_data}
          next_bonustime = %{ps.state.bonustime | active_session: next_active_session}
          next_state = %{ps.state | bonustime: next_bonustime}

          if next_session_data["throws_remaining"] == 0 do
            token_type = Map.get(active_session.data, "token_type")

            with {:ok, claim_data} <- LuckyDice.claim(next_session_data) do
              lucky_dice_claim_result(
                command,
                ps,
                next_state,
                now,
                active_game_id,
                action,
                token_type,
                claim_data
              )
            else
              _ -> lucky_dice_invalid_request(command, ps)
            end
          else
            lucky_dice_ok_result(
              command,
              ps,
              next_state,
              next_bonustime,
              now,
              active_game_id,
              action
            )
          end
        else
          _ -> lucky_dice_invalid_request(command, ps)
        end

      action == "throw" ->
        if active_session do
          lucky_dice_invalid_request(command, ps)
        else
          with {:ok, held_indexes} <- fetch_held_indexes(intent_map),
               {:ok, next_state, token_type} <-
                 BonusTime.spend_token_for_game(ps.state, "lucky_dice", now) do
            next_state =
              if token_type == "daily" do
                new_bonustime = %{
                  next_state.bonustime
                  | bonustime_flips: next_state.bonustime.bonustime_flips + 1
                }

                %{next_state | bonustime: new_bonustime}
              else
                next_state
              end

            session_data = LuckyDice.start_session(next_state.bonustime.streak, token_type, now)

            with {:ok, next_session_data} <- LuckyDice.throw(session_data, held_indexes) do
              next_active_session = %State.ActiveSession{
                type: "lucky_dice",
                data: next_session_data
              }

              next_bonustime = %{next_state.bonustime | active_session: next_active_session}
              next_state = %{next_state | bonustime: next_bonustime}

              if next_session_data["throws_remaining"] == 0 do
                with {:ok, claim_data} <- LuckyDice.claim(next_session_data) do
                  lucky_dice_claim_result(
                    command,
                    ps,
                    next_state,
                    now,
                    active_game_id,
                    "throw",
                    token_type,
                    claim_data
                  )
                else
                  _ -> lucky_dice_invalid_request(command, ps)
                end
              else
                lucky_dice_ok_result(
                  command,
                  ps,
                  next_state,
                  next_bonustime,
                  now,
                  active_game_id,
                  "throw"
                )
              end
            else
              _ -> lucky_dice_invalid_request(command, ps)
            end
          else
            {:error, _reason} ->
              {"failed", error_result("no_tokens", command), ps.id}
          end
        end

      (action == "claim" and active_session) && active_session.type == "lucky_dice" ->
        with {:ok, claim_data} <- LuckyDice.claim(active_session.data) do
          token_type = Map.get(active_session.data, "token_type")

          lucky_dice_claim_result(
            command,
            ps,
            ps.state,
            now,
            active_game_id,
            "claim",
            token_type,
            claim_data
          )
        else
          _ -> lucky_dice_invalid_request(command, ps)
        end

      true ->
        lucky_dice_invalid_request(command, ps)
    end
  end

  defp lucky_dice_claim_result(
         command,
         ps,
         base_state,
         now,
         active_game_id,
         action,
         token_type,
         claim_data
       ) do
    tier = claim_data["tier"]
    claimed_tiers = claim_data["claimed_tiers"] || []
    dice = claim_data["dice"] || []

    {rewarded_state, reward_amount} =
      Incrementalist.Game.Rewards.grant_bonus_reward(base_state, tier)

    bonustime_after_reward = rewarded_state.bonustime

    reward_counts =
      Map.update(bonustime_after_reward.reward_counts, "tier_#{tier}", 1, &(&1 + 1))

    if claim_data["final"] do
      streak_state = BonusTime.advance_streak(rewarded_state, now)
      bonustime_after_streak = streak_state.bonustime

      last_result = %{
        "game_id" => "lucky_dice",
        "tier" => tier,
        "rolls" => claimed_tiers,
        "claimed_tiers" => claimed_tiers,
        "dice" => dice,
        "outcome" => claim_data["outcome"],
        "reward_amount" => reward_amount,
        "token_type" => token_type,
        "played_at" => Time.iso8601(now)
      }

      next_bonustime = %{
        bonustime_after_streak
        | total_games_played: bonustime_after_streak.total_games_played + 1,
          reward_counts: reward_counts,
          last_result: last_result,
          active_session: nil
      }

      next_state =
        %{streak_state | bonustime: next_bonustime}
        |> Achievements.evaluate()

      lucky_dice_ok_result(
        command,
        ps,
        next_state,
        next_bonustime,
        now,
        active_game_id,
        action
      )
    else
      next_active_session = %{
        base_state.bonustime.active_session
        | data: claim_data["session"]
      }

      next_bonustime = %{
        bonustime_after_reward
        | reward_counts: reward_counts,
          active_session: next_active_session
      }

      next_state =
        %{rewarded_state | bonustime: next_bonustime}
        |> Achievements.evaluate()

      lucky_dice_ok_result(
        command,
        ps,
        next_state,
        next_bonustime,
        now,
        active_game_id,
        action
      )
    end
  end

  defp lucky_dice_ok_result(command, ps, next_state, next_bonustime, now, active_game_id, action) do
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

    projected_bonustime = projected_bonustime_payload(next_bonustime, active_game_id)

    {"succeeded",
     %{
       "type" => "bonustime.play.result",
       "status" => "ok",
       "command_id" => command.command_id,
       "coins" => next_state.coins,
       "has_bonustime_token" => next_state.has_bonustime_token,
       "bonustime" => projected_bonustime,
       "achievements" => State.visible_achievements(next_state.achievements),
       "notices" => Notices.payload(next_notices),
       "action" => action
     }, ps.id}
  end

  defp lucky_dice_invalid_request(command, ps) do
    {"failed", error_result("invalid_request", command), ps.id}
  end

  defp projected_bonustime_payload(next_bonustime, active_game_id) do
    Map.merge(Map.from_struct(next_bonustime), %{
      "active_game_id" => active_game_id
    })
  end

  defp player_state(player, now) do
    # Reloading ensures we have the latest state from the database.
    player = Repo.get!(Player, player.id)
    ps = PlayerStates.load_or_create(player, now)

    if ps && ps.state do
      new_state =
        ps.state
        |> State.check_daily_reset(now)
        |> OrchardSoil.project_state(now)

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

  defp fetch_discovery_id(%{"discovery_id" => discovery_id}) when is_binary(discovery_id),
    do: {:ok, discovery_id}

  defp fetch_discovery_id(%{discovery_id: discovery_id}) when is_binary(discovery_id),
    do: {:ok, discovery_id}

  defp fetch_discovery_id(_intent), do: {:error, "discovery_id_required"}

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

  defp fetch_held_indexes(%{"held_indexes" => held_indexes}) when is_list(held_indexes),
    do: validate_held_indexes(held_indexes)

  defp fetch_held_indexes(%{held_indexes: held_indexes}) when is_list(held_indexes),
    do: validate_held_indexes(held_indexes)

  defp fetch_held_indexes(_intent), do: {:error, "held_indexes_required"}

  defp validate_held_indexes(held_indexes) when is_list(held_indexes) do
    valid_indexes = Enum.filter(held_indexes, &is_integer/1)
    normalized = normalize_held_indexes(valid_indexes)

    if length(valid_indexes) == length(held_indexes) and
         length(normalized) == length(valid_indexes) do
      {:ok, normalized}
    else
      {:error, "invalid_index"}
    end
  end

  defp validate_held_indexes(_held_indexes), do: {:error, "invalid_index"}

  defp normalize_held_indexes(indexes) do
    indexes
    |> Enum.filter(&(&1 in 0..6))
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp maybe_put_plinko_payload(last_result, rolls) when is_map(rolls) do
    Map.put(last_result, "plinko", rolls["plinko"])
  end

  defp maybe_put_plinko_payload(last_result, _rolls), do: last_result

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

    bonustime_flips =
      if Map.has_key?(attrs, :state) do
        PlayerState.extract_bonustime_flips(attrs.state)
      else
        attrs[:bonustime_flips] || ps.bonustime_flips
      end

    attrs =
      attrs
      |> Map.put(:has_bonustime_token, has_bonustime_token)
      |> Map.put(:bonustime_flips, bonustime_flips)

    # Standard update
    updated_ps = Repo.update!(PlayerState.changeset(ps, attrs))

    # HAMMER: Force the column update. No more excuses.
    import Ecto.Query

    _ =
      from(s in PlayerState, where: s.id == ^ps.id)
      |> Repo.update_all(
        set: [has_bonustime_token: has_bonustime_token, bonustime_flips: bonustime_flips]
      )

    updated_ps
  end

  defp maybe_adjust_its_bonus_time_result(last_result, %{
         "board" => board,
         "flips" => flips,
         "coins_others" => coins_others
       }) do
    total_coins = BigNum.add(coins_others, last_result["reward_amount"])

    Map.merge(last_result, %{
      "reward_amount" => total_coins,
      "board" => board,
      "flips" => flips
    })
  end

  defp maybe_adjust_its_bonus_time_result(last_result, _), do: last_result

  defp maybe_adjust_card_pick_result(last_result, %{
         "board" => board,
         "flips" => flips,
         "coins_others" => coins_others
       }) do
    total_coins = BigNum.add(coins_others, last_result["reward_amount"])

    Map.merge(last_result, %{
      "reward_amount" => total_coins,
      "board" => board,
      "flips" => flips
    })
  end

  defp maybe_adjust_card_pick_result(last_result, _), do: last_result

  defp maybe_adjust_scratch_card_result(last_result, %{
         "pixels_budget" => pixels_budget,
         "reveal_schedule" => reveal_schedule,
         "coins_others" => coins_others
       }) do
    total_coins = BigNum.add(coins_others, last_result["reward_amount"])

    Map.merge(last_result, %{
      "reward_amount" => total_coins,
      "pixels_budget" => pixels_budget,
      "reveal_schedule" => reveal_schedule
    })
  end

  defp maybe_adjust_scratch_card_result(last_result, _), do: last_result

  defp maybe_adjust_reward_labyrinth_result(last_result, %{
         "chests" => chests,
         "steps_total" => steps_total,
         "coins_others" => coins_others
       }) do
    total_coins = BigNum.add(coins_others, last_result["reward_amount"])

    Map.merge(last_result, %{
      "reward_amount" => total_coins,
      "chests" => chests,
      "steps_total" => steps_total
    })
  end

  defp maybe_adjust_reward_labyrinth_result(last_result, _), do: last_result

  defp maybe_adjust_hammer_smash_result(last_result, %{
         "smashes" => smashes,
         "coins_others" => coins_others
       }) do
    total_coins = BigNum.add(coins_others, last_result["reward_amount"])

    Map.merge(last_result, %{
      "reward_amount" => total_coins,
      "smashes" => smashes
    })
  end

  defp maybe_adjust_hammer_smash_result(last_result, %{"smash_1_power" => _} = smashes) do
    Map.put(last_result, "smashes", smashes)
  end

  defp maybe_adjust_hammer_smash_result(last_result, _), do: last_result

  defp delete_one(list, item) do
    case Enum.split_while(list, &(&1 != item)) do
      {left, [_ | right]} -> left ++ right
      _ -> list
    end
  end

  defp delete_one_card(list, item) do
    case Enum.split_while(list, &(&1 != item)) do
      {left, [_ | right]} -> left ++ right
      _ -> list
    end
  end

  defp delete_one_chest(list, item) do
    case Enum.split_while(list, &(&1 != item)) do
      {left, [_ | right]} -> left ++ right
      _ -> list
    end
  end
  defp fetch_plot_id(%{"plot_id" => plot_id}) when is_binary(plot_id), do: {:ok, plot_id}
  defp fetch_plot_id(%{plot_id: plot_id}) when is_binary(plot_id), do: {:ok, plot_id}
  defp fetch_plot_id(_intent), do: {:error, "plot_id_required"}

  defp parse_plot_index("plot_" <> num) do
    case Integer.parse(num) do
      {val, ""} -> {:ok, val}
      _ -> {:error, "invalid_plot_id"}
    end
  end
  defp parse_plot_index(_), do: {:error, "invalid_plot_id"}

  defp fetch_seed_id(%{"seed_id" => seed_id}) when is_binary(seed_id), do: {:ok, seed_id}
  defp fetch_seed_id(%{seed_id: seed_id}) when is_binary(seed_id), do: {:ok, seed_id}
  defp fetch_seed_id(_intent), do: {:error, "seed_id_required"}

  defp fetch_action(%{"action" => action}) when is_binary(action), do: {:ok, action}
  defp fetch_action(%{action: action}) when is_binary(action), do: {:ok, action}
  defp fetch_action(_intent), do: {:error, "action_required"}

  defp fetch_seed_a(%{"seed_a" => seed_a}) when is_binary(seed_a), do: {:ok, seed_a}
  defp fetch_seed_a(%{seed_a: seed_a}) when is_binary(seed_a), do: {:ok, seed_a}
  defp fetch_seed_a(_intent), do: {:error, "seed_a_required"}

  defp fetch_seed_b(%{"seed_b" => seed_b}) when is_binary(seed_b), do: {:ok, seed_b}
  defp fetch_seed_b(%{seed_b: seed_b}) when is_binary(seed_b), do: {:ok, seed_b}
  defp fetch_seed_b(_intent), do: {:error, "seed_b_required"}

  defp fetch_amount(%{"amount" => amount}) when is_integer(amount), do: {:ok, amount}
  defp fetch_amount(%{amount: amount}) when is_integer(amount), do: {:ok, amount}
  defp fetch_amount(_intent), do: {:error, "amount_required"}

  defp get_seed_inventory(state, seed_id) do
    case seed_id do
      "clover_seeds" -> state.clover_seeds || BigNum.zero()
      "acorn" -> state.acorns || BigNum.zero()
      "coin_tree_seed" -> state.coin_tree_seeds || BigNum.zero()
      _ -> BigNum.zero()
    end
  end

  defp update_seed_inventory(state, seed_id, val) do
    case seed_id do
      "clover_seeds" -> %{state | clover_seeds: val}
      "acorn" -> %{state | acorns: val}
      "coin_tree_seed" -> %{state | coin_tree_seeds: val}
      _ -> state
    end
  end

  defp roll_weighted(weight_map) do
    if map_size(weight_map) == 0 do
      0
    else
      roll = :rand.uniform(100)
      
      Enum.reduce_while(weight_map, 0, fn {amount_str, weight}, acc ->
        next_acc = acc + weight
        if roll <= next_acc do
          {:halt, String.to_integer(amount_str)}
        else
          {:ok, next_acc}
        end
      end)
      |> case do
        val when is_integer(val) -> val
        _ -> 0
      end
    end
  end

  defp clamp_big_num_non_negative(%BigNum{} = value) do
    if BigNum.compare(value, BigNum.zero()) < 0 do
      BigNum.zero()
    else
      value
    end
  end

  defp normalize_big_num(%BigNum{} = value), do: value
  defp normalize_big_num(%{"m" => m, "e" => e}), do: BigNum.new(number(m), trunc(number(e)))
  defp normalize_big_num(%{m: m, e: e}), do: BigNum.new(number(m), trunc(number(e)))
  defp normalize_big_num(value) when is_number(value), do: BigNum.from_number(value)
  defp normalize_big_num(_), do: BigNum.zero()

  defp number(value) when is_integer(value), do: value * 1.0
  defp number(value) when is_float(value), do: value
  defp number(_value), do: 0.0
end
