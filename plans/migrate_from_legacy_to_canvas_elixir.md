# Migration Plan: Legacy Canvas Prototype to Phoenix + Canvas/WebGL

## Goal

Recreate the legacy game with exactly the same functionality using the repo-wide rules in `AGENTS.md`.

The legacy prototype in `legacy/game` is the behavioral specification, but its structure is not suitable for the real game. In particular, `legacy/game/game.js` combines boot, game loop, input routing, persistence, feature orchestration, modal state, and visual effects. The migration must preserve exact player-visible functionality while replacing the legacy AI-slop structure with clean, best-practice architecture.

## Progress Implementation Notes

Store enough information to lazily derive current progress when a command arrives.

Server stores durable progress state.

Fill rate is derived from current authoritative save facts, such as idle mode,
Sisu, sisu decay, level, last_claimed_at.

`can_claim` is derived by the server after lazy advancement. Do not persist it as a separate save field: progress at `100%` is claimable.

Client projection state machine:

```txt
projecting -> awaiting_server_confirmation -> confirmed_collectible
                                  |
                                  -> corrected_projection
```

These states are implementation-only. They must not introduce player-facing
labels, messages, or alternate progress modes. The player sees the legacy
progress bar and percent counter. When client-projected fill reaches `100%`,
the client immediately asks the server whether it may tell the player the bar
is collectible. Until the server confirms, the player must not see `ACT!` or
the WebGL 100% burst animation. After confirmation, the client shows the legacy
100% burst animation and `ACT!`.

### Claim flow:

#### Check if claim is possible
1. Client sends `progress.can_claim`.
2. Server checks `can_claim_at` and responds with `can_claim_in` (delta until claim).
3. If `can_claim_in == 0`, allow claim in the Client, play burst animation and display the ACT! label. Otherwise postpone claim animation etc by `can_claim_in`.

#### When the player can claim:
4. User claims reward => Client sends `progress.claim_reward`.
6. Server calculates the reward and responds with minimum slice of final values, progress.claim_result, not delta, for example:
```
{
  coins: 220434,
  exp: 40030423,
  shards: 100439,
  cores: 1432
}
```
7. Client sets the new values for coins, exp, etc. and sends ACK
8. When server receives ACK, it sets last_claimed_at, rewards_claimed, etc. and calculates can_claim_at from the player's server state.

`progress.claim_result` is not a full snapshot. It should include changed
final values only, such as `coins`, `exp`, `shards`, `cores`. The client may derive
popup deltas from the previous authoritative values for display, but the result
itself should remain a narrow command result.

The server result must not include UI display instructions, popup anchors,
animation directives, or reward-display events. The command says what the user
did; the result says which authoritative values to set.

## Card Pick Implementation Notes

Preferred model:

```txt
client: card_pick.start
server: creates hidden session and returns visible session state

client: card_pick.reveal with picked count
server: validates the picked count against the server-owned session phase, calculates, and returns all 36 reveal results. The first X results are the picked cards; the rest are the missed cards.

client: card_pick.advance_or_complete
server: decides whether bonus phase starts, updates session, returns visible phase data
```

## Target Backend Structure

```txt
lib/incrementalist/
  accounts/
  game/
    state.ex
    commands.ex
    sessions.ex
    snapshots.ex
    time.ex
    features/
      areas/
      achievements/
      quests/
      shops/
      daily_bonus/
      progress/
        bar/
        sisu/
    persistence/
      save_slots.ex
      command_log.ex

lib/incrementalist_web/
  controllers/
    boot_controller.ex
    save_slot_controller.ex
  channels/
    game_channel.ex
```

Recommended initial persistence:

- `accounts` or simple users table.
- `save_slots` with `state` as versioned `jsonb`.
- `game_commands` table for idempotent command processing and short-term replay.
- Every hour, remove ACKed `game_commands` rows older than 48 hours.

Avoid over-normalizing early. The rules are still evolving, and a versioned JSON state is easier to migrate during game design iteration.

## Target Frontend Structure

```txt
assets/src/
  app.ts
  core/
    game-loop.ts
    clock.ts
    input.ts
    event-bus.ts
    assets.ts
  net/
    game-channel.ts
    protocol.ts
    snapshots.ts
    commands.ts
  render/
    webgl/
    effects/
    layout/
  ui/
    components/
      button.ts
      dropdown.ts
      modal.ts
      tooltip.ts
    overlays/
  features/
    progress/
      view-model.ts
      render.ts
      interactions.ts
      sisu/
    areas/
    shop/
    quests/
    achievements/
    daily-bonus/
    save-slots/
  theme/
    colors.ts
    fonts.ts
```

Frontend state categories:

- `serverSnapshot`: latest authoritative state received from Phoenix.
- `projectionState`: reversible display estimates derived from the snapshot.
- `uiState`: open modals, hover, selected indexes, focused controls.
- `effectState`: particles, floating text, WebGL bursts, transitions.

Canvas-only UI contract:

- The game UI is Canvas/WebGL. HTML elements may exist only as temporary bootstrap scaffolding around the canvas while a feature's real Canvas surface has not been ported.
- Do not build new gameplay functionality on top of Phase 1 HTML buttons, status text, slot lists, or other DOM controls.
- When a Canvas surface for a feature is introduced, it must replace the temporary HTML for that feature rather than wrapping, styling, or extending the DOM scaffolding.
- DOM may host the canvas and non-game browser shell only. Gameplay display, menus, overlays, buttons, hit testing, hover state, and modal-like flows belong in Canvas/WebGL modules.

## Migration Phases

### Phase 1: Foundation

- Add frontend build tooling under `assets/` without changing the command/result protocol.
- Remove/replace the `/api/clicks` prototype; it is not part of legacy game functionality.
- Use Phoenix Channels as the Phase 1 transport.
- Define the game command/result protocol: the only gameplay communication pattern is client command -> server result.
- Client commands send command intent plus a client-generated integer `command_id`, not active save slots, snapshot versions, or generic payload envelopes.
- Client command ids are the indexes of a 10-slot local boolean queue: `true` means waiting for the authoritative result, `false` means not waiting for that result.
- Server owns active save slot, FIFO queue order, replay state, and result tracking.
- Every accepted client command must receive a server result.
- Server results include the minimum required authoritative state for that command; they do not need to include a full snapshot every time.
- Use full snapshots when full state is required, such as boot or reconnect.
- Add `save_slots` and `game_commands` persistence.
- Identify anonymous players with a server-issued anonymous player token. Persist this token in localStorage.
This token then becomes persisted in the players table when the player chooses to create a user account.
Tokens without player are deleted after 1 month of inactivity.
- Implement 4 anonymous save slots per player.
- Match legacy save-slot boot selection: last valid slot, else first populated slot, else slot 0.
- Implement save-slot switching and reset confirmation flow.
- Do not require boot/reconnect to send all 4 save-slot summaries.
- Save screen visible info is presentation state and is not authoritative gameplay state. The server overwrites with authoritative slot state when a slot is loaded.
- Autosave the current slot before switching slots.
- Any HTML status, button, or save-slot UI used in Phase 1 is temporary scaffolding only. It must not become the extension point for later features.
- Add a per-player FIFO command queue backed by `game_commands`.
- Process only one command at a time for each player.
- Allow up to 10 queued commands per player.
- `command.queued` includes only `command_id`; it must not expose command type or queue position.
- Queue-full or invalid command-id rejections are transport errors, not gameplay result variants.
- Commands execute once. Until the client acknowledges receipt, reconnect re-sends the stored command result instead of re-running game rules.
- Add explicit client `command.ack` messages after the client applies a command result. ACK payload is only the applied `command_id`.
- ACK requires the authoritative result to be applied, not cosmetic animations to finish.
- Process the next queued command only after the server receives ACK for the current command result.
- Withholding ACKs must not duplicate rewards or state changes; it only keeps the player blocked on the same queued result.
- Save-slot load, switch, and reset commands are exclusive boundaries: once sent, the client must block further commands behind a loading state until the result is applied and ACKed.
- Save-slot load, switch, and reset results clear pending command queues on both client and server so commands from one save cannot carry over into another save.
- Save-slot load, switch, and reset also clear save-local client activity state, including progress verification waits, confirmed-collectible flags, pending claim intent, input-derived activity, and cosmetic effects. Activity from one save file must never complete after another save file becomes active.
- Keep unacked commands indefinitely; continue blocking/replaying until ACK.
- Store command result data needed for replay, including the server result, queue status, and success/error.
- Add the hourly cleanup job that removes ACKed `game_commands` older than 48 hours.
- Implement execute-once replay handling.
- Add backend tests for FIFO ordering, execute-once replay, ACK-gated advancement, queue full rejection, reconnect replay, and ACKed-only cleanup.
- Create a minimal Canvas boot that renders from a server snapshot.

Deliverable: client connects, selects the correct active save slot, receives required authoritative state, renders a minimal Canvas scene, can switch or reset slots through temporary scaffolding, and can send no-op commands. The temporary HTML controls are explicitly not product UI.

### Phase 2: Progress Loop

- Port progress bar and progression rules to Elixir.
- Implement lazy progress advancement.
- `progress.claim_reward` must apply the full legacy progress-bar reward mutation on the server: EXP, coins, shards, cores, level-up application, reward counters, and progress reset.
- `progress.claim_reward.result` must return only changed final authoritative values, not a full snapshot.
- `progress.claim_reward.result` must not include UI display instructions, popup anchors, animation directives, or presentation-only events.
- Add frontend projection and an internal server-confirmation wait.
- Add the legacy 100% burst animation and `ACT!` only after server confirmation; do not add player-facing loading, verifying, or alternate progress text.
- Match legacy collection input: once the server has confirmed collectibility, any manual player activity on the Canvas surface can send claim intent, including click, pointer movement, and key press. Collection is not limited to clicking directly on the progress bar.
- Render the progress-claim reward display exactly like legacy for the progress reward itself, including popup placement, fade-out, and movement behavior.

Deliverable: the core incremental loop works with server-authorized collectibility and rewards.

### Phase 3: Currencies, Levels, and Rewards

- Port or refine level-up reward events that need distinct presentation beyond the Phase 2 claim mutation.
- Implement a centralized state handler on the client (e.g., `applyAuthoritativeData(state, data)`) to ensure that EXP gains, level-ups, and currency mutations returned in *any* server result are merged consistently and trigger their respective presentations, instead of mutating state across multiple individual command handlers willy-nilly.
- Omit cross-feature dependencies from server reward evaluation (e.g., Sisu refills on level-up) until their respective features are ported in later phases.
- EXP bar and level are calculated client-side, but without authority.
- Return changed final authoritative values from the server; do not send presentation-only reward or level-up events. The client derives level-up presentation from changes in the authoritative `exp` and `level` returned in standard command results.
- Render the top HUD currency and level display from authoritative snapshots and command results.
- Render top-HUD resource counters and level-up reward presentation by deriving display behavior from authoritative values and local unauthorized UI state.
- Add rule tests for deterministic reward paths. Use Elixir's process dictionary seed (`:rand.seed/2`) in tests to make standard library RNG (`Enum.random/1`, `:rand.uniform/0`) deterministic without polluting the `Game.State` with a seed.

### Phase 4: Canvas Menu Shell and Save Files

- Port the legacy bottom menu button and overlay shell to Canvas.
- Implement Canvas hit testing and keyboard handling for opening and closing the menu overlay.
- Implement the Save Files tab in the Canvas menu overlay.
- Replace the temporary Phase 1 HTML save-slot list, save button, reset button, slot readout, and related DOM click handling with Canvas-rendered save-file UI and Canvas hit tests.
- Keep save-file visible info as presentation state. Slot switching and reset confirmation still use server commands.
- Move reset confirmation into the Canvas overlay flow, matching legacy behavior.
- Remove temporary DOM gameplay controls that are no longer needed once the Canvas menu owns save files.

Deliverable: save-file selection and reset live in the Canvas menu overlay, and the temporary HTML save-slot UI is gone.

### Phase 5: Areas

- Port area definitions and unlock requirements to Elixir.
- Implement `area.select`.
- Frontend keeps area rendering modular.
- Locked areas display server-provided unlock requirements.

Deliverable: area selection and unlock visibility work without client rule ownership.

### Phase 6: Shop and Locked Elements

- Port feature shop definitions to Elixir.
- Implement `shop.purchase`.
- Render the Shop tab inside the main menu overlay.
- Implement unlock destination metadata in snapshots.
- Keep locked-element UI as presentation only.
- Highlight unlock destination on client based on server metadata.

Deliverable: Idle Mode, Sisu Generator, and Bonus Time unlocks are server-authorized. The features themselves 

### Phase 7: Idle Mode

- Implement `progress.set_idle_mode`.
- Make idle-mode fill rate part of server-issued projection parameters.

Deliverable: idle mode changes fill pacing and updates the HUD smoothly.

### Phase 8: Sisu

- Port Sisu state, refill tiers, max upgrade costs, and decay to Elixir.
- Use lazy time advancement for Sisu decay.
- Sisu decay only advances while the progress bar is filling.
- Use a closed-form geometric projection per round rather than a per-second simulation loop.
- Server-provided projection data should include `can_claim_at` and `boost_at_round_end`.
- Rename `boost_at_round_end` to `sisu_at_claim`.
- `sisu_at_claim` is the exact projected multiplier at the moment of `can_claim_at`.
- Recompute those projection values immediately after any Sisu change.
- Expose Sisu as a dedicated top-level snapshot object.
- Implement `sisu.refill` and `sisu.upgrade_max`.
- Keep the legacy Sisu Generator modal for refill and upgrade actions.
- `sisu.refill` and `sisu.upgrade_max` return narrow command results.
- Those results include the full `sisu` object plus `can_claim_at` and `sisu_at_claim`.
- Frontend renders Sisu meter and refill controls from snapshots.

Deliverable: Sisu meter, refills, max upgrades, and decay are ported.

### Phase 9: Quests and Achievements

- Port quest and achievement definitions to Elixir.
- Implement server-side evaluation after relevant commands.
- Implement `quest.claim` and `quest.claim_all`.
- Render Quests and Achievements tabs inside the Canvas menu overlay.
- Return achievement-unlocked and quest-claimed events for animation.
- Integrate Quests/Achievements notice behavior into the centralized notice system (do not add feature-local notice logic).
- Register all quest/achievement notice IDs in the server-owned notice registry (no ad-hoc UI string IDs).
- Define parent chains in the server registry (for example quest/achievement leaves -> tab parent -> main menu parent).
- Use semantic notice events only (`child_shown`, `child_clicked`) and idempotent handling.
- Parent clear must occur on child shown (visible/active), child clear on child click.
- Client must emit notice events only for currently active noticed children; no per-frame spam.
- Snapshot/result payloads must include authoritative `active_leaf_ids` and `active_parent_ids` so Quest/Achievement tabs render notice state without client-derived heuristics.

Deliverable: reward multiplier is server-derived from quest and achievement state.

### Phase 10: Daily Bonus

- Port daily token rotation, streaks, reward counts, and one-shot games.
- Implement `daily_bonus.open`, `daily_bonus.play`, and game-specific commands.
- Render the Daily tab and daily bonus interactions in Canvas.
- Keep client animations reveal-only.

Deliverable: daily bonus loop, one-shot games, and reveal animations are ported.

### Phase 11: Card Pick

- Replace the legacy client-board model.
- Server stores session state.
- Client sends reveal intent with picked count only, not selected indexes.
- Server accepts the picked count only if it matches the server-owned session phase.
- Client may remember which visible card positions the player clicked as UI state, then map server reveal results onto those positions.
- Server calculates reveal outcomes only when reveal is requested.
- Reveal response includes all 36 results: picked results first, then missed results.
- Bonus phases reveal only allowed information.

Deliverable: Card Pick session lifecycle and reveal flow are ported.

### Phase 13: Legacy Removal

- Keep `legacy/` as a reference until all features are ported.
- Once parity is achieved, move any remaining assets into the new asset pipeline.
- Remove old localStorage save code.
- Remove old monolithic game bootstrap.
- Remove any remaining temporary HTML gameplay scaffolding. The app shell should host the Canvas/WebGL surface, not gameplay controls.

Deliverable: the real game no longer depends on `legacy/game`.

## Testing Strategy

Backend rule tests:

- Command queue FIFO ordering.
- Execute-once command replay.
- ACK-gated queue advancement.
- Queue full rejection.
- Reconnect replay for unacked command results.
- ACKed-only command cleanup.
- Progress lazy advancement.
- Progress full verification.
- Claim reward not-ready correction.
- Claim reward success and reset.
- Level-up rewards.
- Shop purchase requirements.
- Sisu refill, upgrade, and lazy decay.
- Quest claim and multiplier.
- Achievement unlocks.
- Daily token rotation.
- Card Pick selection validation.
- Card Pick reveal serialization safety.

Frontend tests:

- Protocol decode/encode.
- Snapshot to view-model conversion.
- Progress projection state machine.
- Hit testing for buttons, dropdowns, cards, and overlays.
- Canvas menu and Save Files tab hit testing.
- Rendering smoke tests for nonblank Canvas/WebGL.

## Non-Goals During Migration

- Do not build every feature at once.
- Do not normalize every game field into relational tables before rules stabilize.
