# Player Push Plan

## Goal
Move recurring per-player projection updates to server push, while keeping durable gameplay transitions in command/result.

## Scope (Feature Mapping)
Move these fields/features to `player push`:
- `projection_params` (`current_fill`, `can_claim_at`, `current_sisu`, `current_sisu_decay`, `sisu_at_claim`, `sisu_decay_at_claim`)
- `soil` visible state (hourly UTC projection)
- `sisu` visible state where needed for projection consistency
- `has_bonustime_token` boundary grant visibility
- Optional: minimal `bonustime` projection fields affected by boundaries
- `server_time`

Keep these out of player push:
- Purchases, claims, upgrades, unlocks, quest/achievement grants, RNG outcomes
- Queue/ACK lifecycle data

## Current Pull Paths Being Replaced
- Client hourly `time.sync` loop
- Client `progress.claim_in` verification loop for recurring projection refresh

## Event Contract (v1)
Event name: `player.projection.tick`

Payload:
- `type: "player.projection.tick"`
- `server_time: ISO8601 UTC`
- `projection_params`
- `soil`
- `sisu`
- `has_bonustime_token`
- optional `bonustime` subset (only if boundary-changed and visible)

Rules:
- No ACK
- Merge-only update
- Ignore stale events by `server_time`

## Cadence
- Hourly UTC climate boundary for soil/projection refresh.
- BonusTime boundaries when personal visible state changes (token grant/rotation-dependent projection).
- Optional additional server-owned recurrence boundaries only when they mutate visible per-player projection.

## Backend Work
1. In `PlayerServer`, schedule per-player tick generation on recurrence boundaries.
2. Reuse existing projection functions (`State.projection_params`, `OrchardSoil.project_state`) for payload shaping.
3. Route pushes through channel process (no command queue impact).

## Frontend Work
1. Add typed handling for `player.projection.tick`.
2. Apply through centralized authoritative/projection merge path.
3. Keep `synchronize(server_time)` on each push.
4. Remove/disable command-based recurring polling only after soak.

## Acceptance
- Idle connected player sees bar/soil/token projection advance without sending commands.
- Progress reward claim flow remains non-blocking and still retries on `claim_not_ready` using `can_claim_in`.
- No durable state transition occurs from push events.
