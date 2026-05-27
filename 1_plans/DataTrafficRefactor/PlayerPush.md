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

Explicitly out of scope here:
- Session takeover / single-tab ownership / supersede shutdown flow.

## Current Pull Paths Being Replaced
- Client hourly `time.sync` loop
- Any command-based recurring projection polling used only as background refresh

## Event Contract (v1)
Event names:
- `player.projection.tick`

`player.projection.tick` payload:
- `type: "player.projection.tick"`
- `server_time: ISO8601 UTC`
- `soil` (full payload every tick)
- optional `has_bonustime_token` (always included on first tick after join, then change-only)
- optional future recurring visible projection fields (non-durable only)

Rules:
- No ACK
- Merge-only update
- Ignore stale events only when `server_time` is strictly older (`<`)
- Equal `server_time` is valid and must be accepted
- When no connected session exists for a player, do not buffer `player.projection.tick`; recompute projection from authoritative server state on next join.

## Cadence
- UTC minute boundaries only (`...:00.000Z` absolute time)
- Not process-relative 60s intervals

## Backend Work
1. In `PlayerServer`, schedule per-player minute ticks at absolute UTC minute boundaries.
2. Build payload from authoritative projected state (`OrchardSoil.project_state` -> visible `soil`).
3. Track last pushed token state and include `has_bonustime_token` only when changed.
4. Route pushes via PubSub + channel `push/3` (not `phx_reply`), without touching command queue semantics.
5. Keep command pipeline unchanged (dedupe/FIFO/replay/ACK gating remain authoritative).
6. Remove token mutation sources (`Incrementalist.Workers.BonusTimeGrant` and daily-reset token grant in `State.check_daily_reset/2`) and compute token authority from boundary-index server rules only.
7. Skip per-player push emission when no connected session exists; no offline tick buffering.

## Frontend Work
1. Add typed handling for `player.projection.tick`.
2. Apply through centralized merge path (`applyPushEvent` -> `applyAuthoritativeData`), no ad-hoc mutations.
3. Keep `synchronize(server_time)` on each push.
4. Immediate cutover: remove hourly `time.sync` fallback and dead recurring refresh polling in the same change.
5. In the same cutover, remove command-result auto-inclusion of recurring projection fields (`climate`, `soil`) so push is the single recurring projection lane.
6. Keep claim resolution behavior unchanged: when `progress.claim_reward` returns `claim_not_ready`, continue waiting/retrying using `can_claim_in` until non-error result.

## Interview Decisions
- 2026-05-27: Remove command-result auto-inclusion of `climate`/`soil` in the same `player push` change (not a delayed follow-up).
- 2026-05-27: Remove legacy token mutation paths (`BonusTimeGrant`, daily-reset token grant) in this same phase so `has_bonustime_token` has one server-authoritative source.
- 2026-05-27: Always include `has_bonustime_token` on the first `player.projection.tick` after join, then include only on changes.
- 2026-05-27: No offline `player.projection.tick` buffering; catch up via authoritative projection on next join.

## Acceptance
- Idle connected player sees `soil` and token visibility updates without sending commands.
- Progress reward claim flow remains non-blocking and still retries on `claim_not_ready` using `can_claim_in`.
- Pending claim resolution does not exit early; progress bar remains visually at `0%` during the wait window.
- No durable state transition occurs from push events.
