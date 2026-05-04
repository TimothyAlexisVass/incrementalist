# Migration Plan: Legacy Canvas Prototype to Phoenix + Canvas/WebGL

## Goal

Recreate the legacy game with exactly the same functionality using the repo-wide rules in `AGENTS.md`.

The legacy prototype in `legacy/game` is the behavioral specification, but its structure is not suitable for the real game. In particular, `legacy/game/game.js` combines boot, game loop, input routing, persistence, feature orchestration, modal state, and visual effects. The migration must preserve exact player-visible functionality while replacing the legacy AI-slop structure with clean, best-practice architecture.

## Progress Implementation Notes

Store enough information to lazily derive current progress when a command arrives.

Server stores durable progress state:

```txt
fill
last_progress_at
fill_rate_parameters
can_claim
state_version
```

Server sends snapshots with enough projection data:

```json
{
  "progress": {
    "fill": 42.5,
    "fill_rate": 0.8,
    "estimated_full_at": "2026-05-04T14:05:12Z",
    "can_claim": false
  },
  "server_time": "2026-05-04T14:03:55Z",
  "state_version": 18
}
```

Client projection state machine:

```txt
filling -> verifying_full -> collectible
                    |
                    -> corrected_filling
```

Claim flow:

1. Client sends `progress.claim_reward`.
2. Server lazily advances progress to server now.
3. If not collectible, server returns `not_ready` and a corrected snapshot.
4. If collectible, server calculates rewards, applies level-ups, resets progress, persists, and returns reward events plus the next snapshot.

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
    data/
      areas.ex
      achievement_defs.ex
      quest_defs.ex
      shop_items.ex
      daily_bonus_defs.ex
    rules/
      progress_bar.ex
      progression.ex
      sisu.ex
      shop.ex
      quests.ex
      achievements.ex
      daily_bonus.ex
      card_pick.ex
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
    canvas/
    webgl/
    effects/
    layout/
  ui/
    components/
      button.ts
      dropdown.ts
      modal.ts
      tooltip.ts
      progress-bar.ts
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
  theme/
    colors.ts
    fonts.ts
```

Frontend state categories:

- `serverSnapshot`: latest authoritative state received from Phoenix.
- `projectionState`: reversible display estimates derived from the snapshot.
- `uiState`: open modals, hover, selected indexes, focused controls.
- `effectState`: particles, floating text, WebGL bursts, transitions.

## Migration Phases

### Phase 1: Foundation

- Add frontend build tooling under `assets/` without changing the command/result protocol.
- Remove/replace the `/api/clicks` prototype; it is not part of legacy game functionality.
- Use Phoenix Channels as the Phase 1 transport.
- Define the game command/result protocol: the only gameplay communication pattern is client command -> server result.
- Client commands send only command intent, not command ids, active save slots, snapshot versions, or generic payload envelopes.
- Server assigns command ids, active save slot, queue order, replay state, and result tracking.
- Every client command must receive a server result.
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
- Save UI may be an acceptable MVP in Phase 1, but behavior and visible slot information must match legacy.
- Add a per-player FIFO command queue backed by `game_commands`.
- Process only one command at a time for each player.
- Allow up to 10 queued commands per player.
- Reject new commands with `queue_full` when the player already has 10 queued commands.
- Commands execute once. Until the client acknowledges receipt, reconnect re-sends the stored command result instead of re-running game rules.
- Add explicit client `command.ack` messages after the client applies a command result. ACK means "I applied the current result"; it must not include a client-known command id.
- ACK requires the authoritative result to be applied, not cosmetic animations to finish.
- Process the next queued command only after the server receives ACK for the current command result.
- Withholding ACKs must not duplicate rewards or state changes; it only keeps the player blocked on the same queued result.
- Keep unacked commands indefinitely; continue blocking/replaying until ACK.
- Store command result data needed for replay, including the server result, internal state version, and success/error.
- Add the hourly cleanup job that removes ACKed `game_commands` older than 48 hours.
- Implement server-owned state versioning and execute-once replay handling.
- Add backend tests for FIFO ordering, execute-once replay, ACK-gated advancement, queue full rejection, reconnect replay, and ACKed-only cleanup.
- Create a minimal Canvas boot that renders from a server snapshot.

Deliverable: client connects, selects the correct active save slot, receives required authoritative state, renders basic HUD/save UI, can switch or reset slots, and can send no-op commands.

### Phase 2: Progress Loop

- Port progress state and progression rules to Elixir.
- Implement lazy progress advancement.
- Implement `progress.verify_full`.
- Implement `progress.claim_reward`.
- Add frontend projection and verifying/loading state.
- Add full-burst and `ACT!` only after server confirmation.

Deliverable: the core incremental loop works with server-authorized collectibility and rewards.

### Phase 3: Currencies, Levels, and Rewards

- Port level-up formula and level-up rewards.
- Return reward and level-up events from the server.
- Render top HUD, reward popups, and level-up effects from events.
- Add rule tests for deterministic reward paths.

Deliverable: level, exp, coins, shards, and cores are durable server state.

### Phase 4: Shop and Locked Elements

- Port feature shop definitions to Elixir.
- Implement `shop.purchase`.
- Implement unlock destination metadata in snapshots.
- Keep locked-element UI as presentation only.
- Highlight unlock destination on client based on server metadata.

Deliverable: Idle Mode, Sisu Generator, and Bonus Time unlocks are server-authorized.

### Phase 5: Idle Mode

- Implement `progress.set_idle_mode`.
- Make idle-mode fill rate part of server-issued projection parameters.

Deliverable: idle mode changes fill pacing and updates the HUD smoothly.

### Phase 6: Sisu

- Port Sisu state, refill tiers, max upgrade costs, and decay to Elixir.
- Use lazy time advancement for Sisu decay.
- Implement `sisu.refill` and `sisu.upgrade_max`.
- Frontend renders Sisu meter and refill controls from snapshots.

Deliverable: Sisu meter, refills, max upgrades, and decay are ported.

### Phase 7: Areas

- Port area definitions and unlock requirements to Elixir.
- Implement `area.select`.
- Frontend keeps area rendering modular.
- Locked areas display server-provided unlock requirements.

Deliverable: area selection and unlock visibility work without client rule ownership.

### Phase 8: Quests and Achievements

- Port quest and achievement definitions to Elixir.
- Implement server-side evaluation after relevant commands.
- Implement `quest.claim` and `quest.claim_all`.
- Return achievement-unlocked and quest-claimed events for animation.

Deliverable: reward multiplier is server-derived from quest and achievement state.

### Phase 9: Daily Bonus

- Port daily token rotation, streaks, reward counts, and one-shot games.
- Implement `daily_bonus.open`, `daily_bonus.play`, and game-specific commands.
- Keep client animations reveal-only.

Deliverable: daily bonus loop, one-shot games, and reveal animations are ported.

### Phase 10: Card Pick

- Replace the legacy client-board model.
- Server stores session state.
- Client sends reveal intent with picked count only, not selected indexes.
- Server accepts the picked count only if it matches the server-owned session phase.
- Client may remember which visible card positions the player clicked as UI state, then map server reveal results onto those positions.
- Server calculates reveal outcomes only when reveal is requested.
- Reveal response includes all 36 results: picked results first, then missed results.
- Bonus phases reveal only allowed information.

Deliverable: Card Pick session lifecycle and reveal flow are ported.

### Phase 11: WebGL and Visual Polish

- Move particles, floating text, and WebGL effects into render/effects modules.
- Trigger effects from server events and local cosmetic input events.

Deliverable: legacy visual effects and player-visible behavior are restored on the new architecture.

### Phase 12: Legacy Removal

- Keep `legacy/` as a reference until all features are ported.
- Once parity is achieved, move any remaining assets into the new asset pipeline.
- Remove old localStorage save code.
- Remove old monolithic game bootstrap.

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
- Rendering smoke tests for nonblank Canvas/WebGL.

## Non-Goals During Migration

- Do not build every feature at once.
- Do not normalize every game field into relational tables before rules stabilize.
