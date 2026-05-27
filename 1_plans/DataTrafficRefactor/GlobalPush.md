# Global Push Plan

## Goal
Move shared, UTC-boundary world updates to server push for all connected players.

## Scope (Feature Mapping)
Move these fields/features to `global push`:
- `climate` (`epoch_at`, `year`, `day_in_year`, `c`, `rain_mm`)
- `server_time` (clock sync anchor)

Keep these out of global push:
- Any per-player projection (`soil`, `projection_params`, `has_bonustime_token`, personal notices)
- `active_game_id` (derived client-side; not transported)
- Any durable progression or rewards

Push scope boundary:
- `projection_params` remain command-driven and are excluded from push event contracts.
- After cutover, `climate` and `soil` are removed from routine command-result payload decoration and delivered via push lanes.
- Boot snapshot keeps `climate` and `soil` for first-frame correctness.

## Current Source Paths
- Climate projection: `Incrementalist.Game.Climate.visible_state/1`
- Rotation cadence/constants (for internal validation + client derivation): `Constants.bonustime_slot_ms/0`

## Event Contract (v1)
Event name: `global.tick`

Decision: Keep global and per-player push events separate (`global.tick` and `player.projection.tick`), not a single merged tick.
Decision: Do not send `active_game_id`; do not add any command/query to fetch it.
Decision: Keep canonical push protocol spec in a dedicated doc (`shared/protocol/game-push.md`) and keep AGENTS as summary/pointer.

Payload:
- `type: "global.tick"`
- `server_time: ISO8601 UTC`
- `climate: ClimateState`

Rules:
- No ACK
- Replace/merge only (never command execution)
- Ignore stale events only when `server_time` is strictly older than last applied (`<`); accept equal timestamps.

## Cadence
- Every UTC minute boundary (`...:00.000Z`): emit `global.tick`.
- Coordination: `player.projection.tick` also runs at UTC minute boundaries (defined in masterplan player-push lane).

Player lane cadence note:
- `player.projection.tick` includes full `soil` payload each minute.

## Climate Minute Semantics
- Emit full `climate` payload every minute.
- `rain_mm` is minute-distributed from the hourly weather entry (example: 60 mm/hour => 1 mm each minute).
- `rain_mm` stays decimal in authoritative math/data; client UI presents rain as integer-formatted value.
- `c` fluctuates each minute within `base_temp ± 2C` using deterministic integer jitter.
- Minute temperature jitter is not clamped to seasonal min/max bounds.
- Temperature jitter is keyed by UTC minute index only, producing one global shared temperature per minute.
- Orchard/soil projection follows minute-step updates; dry-down and leaching are applied per minute based on minute water loss.

## BonusTime Token Note
- Direction: retire standalone `BonusTimeGrant` boundary scheduler once token authority is moved into the minute-tick architecture.
- Decision: token eligibility is boundary-index-derived from server UTC boundary markers (no eager mass boolean flips).
- Decision: token is non-stacking boolean; offline players still get eligibility on next contact when boundary index has advanced.
- Decision: keep UTC daily rollover for stats only; remove token-grant mutation from `State.check_daily_reset/2` so token authority remains single-source.
- Decision: reset `bonustime_flips` when `its_bonus_time` reward is granted, not by boundary scheduler.
- Decision: `has_bonustime_token` is pushed on player lane only when changed, not every minute.

## Backend Work
1. Add broadcaster/scheduler process for UTC boundary emissions.
2. Use PubSub fanout topics; `GameChannel` subscribes on join and relays via Phoenix `push` (not `phx_reply`).
3. Keep command pipeline unchanged.

## Frontend Work
1. Add non-`phx_reply` handling in websocket transport.
2. Parse `global.tick` discriminated union.
3. Call `synchronize(server_time)` on receipt.
4. Merge via centralized authoritative apply path.
5. Remove scheduled hourly `time.sync` fallback path immediately at cutover.

Out of Scope
- Do not merge `projection_params` from push events.

## Acceptance
- Idle client receives climate progression without sending commands.
- Active BonusTime game rotates client-side from synchronized server time without any `active_game_id` wire field or fetch command.
- No command ACK behavior changes.
