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
Phases 1-8 are completed and therefore removed from this plan.

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
