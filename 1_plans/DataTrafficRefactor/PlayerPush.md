# Player Push Plan

## Goal
Move recurring per-player non-durable projection updates to server push, while keeping durable gameplay transitions in command/result.

## Scope (Aligned to MasterPlan)
Move these fields/features to `player push`:
- `server_time`
- `soil` visible state (full payload every tick)
- `has_bonustime_token` (change-only: include only when value changed)
- Optional future recurring per-player visible fields only when they are non-durable and server-owned

Keep these out of player push:
- `projection_params` (remains command-driven and out of scope for push lanes)
- Purchases, claims, upgrades, unlocks, quest/achievement grants, RNG outcomes
- Queue/ACK lifecycle data

## Current Pull Paths Being Replaced
- Client hourly `time.sync` loop
- Any command-based recurring projection polling used only as background refresh

## Event Contract (v1)
Event name: `player.projection.tick`

Payload:
- `type: "player.projection.tick"`
- `server_time: ISO8601 UTC`
- `soil` (full payload every tick)
- optional `has_bonustime_token` (only when changed)
- optional future recurring visible projection fields (non-durable only)

Rules:
- No ACK
- Merge-only update
- Ignore stale events only when `server_time` is strictly older (`<`)
- Equal `server_time` is valid and must be accepted

## Cadence
- UTC minute boundaries only (`...:00.000Z` absolute time)
- Not process-relative 60s intervals

## Backend Work
1. In `PlayerServer`, schedule per-player minute ticks at absolute UTC minute boundaries.
2. Build payload from authoritative projected state (`OrchardSoil.project_state` -> visible `soil`).
3. Track last pushed token state and include `has_bonustime_token` only when changed.
4. Route pushes via PubSub + channel `push/3` (not `phx_reply`), without touching command queue semantics.
5. Keep command pipeline unchanged (dedupe/FIFO/replay/ACK gating remain authoritative).

## Frontend Work
1. Add typed handling for `player.projection.tick`.
2. Apply through centralized merge path (`applyPushEvent` -> `applyAuthoritativeData`), no ad-hoc mutations.
3. Keep `synchronize(server_time)` on each push.
4. Immediate cutover: remove hourly `time.sync` fallback and dead recurring refresh polling in the same change.
5. Keep claim resolution behavior unchanged: when `progress.claim_reward` returns `claim_not_ready`, continue waiting/retrying using `can_claim_in` until non-error result.

## Acceptance
- Idle connected player sees `soil` and token visibility updates without sending commands.
- Progress reward claim flow remains non-blocking and still retries on `claim_not_ready` using `can_claim_in`.
- Pending claim resolution does not exit early; progress bar remains visually at `0%` during the wait window.
- No durable state transition occurs from push events.
