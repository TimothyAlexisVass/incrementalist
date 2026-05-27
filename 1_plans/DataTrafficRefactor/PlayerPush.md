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

Single-tab session rule:
- A player may actively play in only one tab.
- When a new tab/session becomes active for the same player, the previous tab must receive a shutdown message, render only that message on `#incrementalist`, and stop all further game updates/interaction processing.
- Takeover happens at `game` channel join: new tab becomes active immediately at join boundary.
- After sending `session.superseded`, server disconnects the old socket/session immediately.
- After this takeover shutdown, the old tab remains locked and must not auto-reconnect/reactivate unless the user performs a manual reload.
- Shutdown rendering is immediate: next frame after `session.superseded` must render only shutdown message (no lingering gameplay/cosmetic animation).
- Shutdown message text is fixed and exact: `This session was opened in another tab.`
- Supersede shutdown cancels all active loops in old tab immediately (including pending `claim_not_ready` retry flow).

## Current Pull Paths Being Replaced
- Client hourly `time.sync` loop
- Any command-based recurring projection polling used only as background refresh

## Event Contract (v1)
Event names:
- `player.projection.tick`
- `session.superseded`

`player.projection.tick` payload:
- `type: "player.projection.tick"`
- `server_time: ISO8601 UTC`
- `soil` (full payload every tick)
- optional `has_bonustime_token` (always included on first tick after join, then change-only)
- optional future recurring visible projection fields (non-durable only)

`session.superseded` payload:
- `type: "session.superseded"`
- `server_time: ISO8601 UTC`
- `reason` (machine-readable; e.g. `new_session_activated`)
- no server-provided display copy; client renders fixed local message by reason

Rules:
- No ACK
- Merge-only update
- Ignore stale events only when `server_time` is strictly older (`<`)
- Equal `server_time` is valid and must be accepted
- After `session.superseded` is applied, client ignores all later push and command-result traffic and remains locked until manual reload.
- Server must also reject commands from superseded sessions using `command.error` with reason `session_superseded`.
- Session identity is server-issued: each websocket join gets a server-generated `session_id`; commands are accepted only from the current active `session_id` for that player.
- Active session ownership is in-memory only (node-local, reset on restart), with no DB persistence.
- Pending processed-but-unacked command results remain replayable and must be delivered to the new active session after takeover.
- When no active tab/session exists for a player, do not buffer `player.projection.tick`; recompute projection from authoritative server state on next join.
- On `session.superseded`, client clears local snapshot cache before entering locked state.

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
7. Enforce one-active-tab per player: activating a new tab must send a shutdown push to the previous tab and revoke its live update stream.
8. Hard-enforce takeover safety server-side: reject any command from superseded session identity with `command.error` reason `session_superseded`.
9. Disconnect superseded socket/session immediately after pushing `session.superseded`.
10. Generate/assign server session ids at join and validate command origin against active session per player.
11. Keep takeover/session ownership in `PlayerServer` (active `session_id`, owning channel pid, supersede/disconnect orchestration).
12. Skip per-player push emission when no active session exists; no offline tick buffering.
13. Extend command error reason contract with `session_superseded`.
14. Perform takeover via direct old-channel-pid orchestration (push `session.superseded` then disconnect) to guarantee ordering.

## Frontend Work
1. Add typed handling for `player.projection.tick`.
2. Apply through centralized merge path (`applyPushEvent` -> `applyAuthoritativeData`), no ad-hoc mutations.
3. Keep `synchronize(server_time)` on each push.
4. Immediate cutover: remove hourly `time.sync` fallback and dead recurring refresh polling in the same change.
5. In the same cutover, remove command-result auto-inclusion of recurring projection fields (`climate`, `soil`) so push is the single recurring projection lane.
6. Keep claim resolution behavior unchanged: when `progress.claim_reward` returns `claim_not_ready`, continue waiting/retrying using `can_claim_in` until non-error result.
7. Handle server shutdown push for superseded tabs by rendering only the shutdown message on the main canvas and stopping gameplay updates/inputs entirely.
8. Clear snapshot cache on `session.superseded` so manual reload boots from fresh authoritative snapshot.
9. Extend protocol/types to include `session_superseded` command error reason.

## Interview Decisions
- 2026-05-27: Remove command-result auto-inclusion of `climate`/`soil` in the same `player push` change (not a delayed follow-up).
- 2026-05-27: Remove legacy token mutation paths (`BonusTimeGrant`, daily-reset token grant) in this same phase so `has_bonustime_token` has one server-authoritative source.
- 2026-05-27: Always include `has_bonustime_token` on the first `player.projection.tick` after join, then include only on changes.
- 2026-05-27: Enforce single-tab play. On new-tab takeover, push a shutdown message to the old tab; old tab must render only that message in-canvas and stop all updates.
- 2026-05-27: Old tab stays hard-locked after takeover (no auto-reconnect); only a manual reload can attempt a new session.
- 2026-05-27: Use dedicated `session.superseded` push event and ignore all subsequent traffic after it on the old tab.
- 2026-05-27: Backend must reject commands from superseded sessions with `command.error` reason `session_superseded`.
- 2026-05-27: Keep `session.superseded` payload machine-readable (`reason` only) and render fixed client message.
- 2026-05-27: On takeover, send `session.superseded` then disconnect old socket/session.
- 2026-05-27: Enforce takeover at `game` channel join boundary (new tab wins immediately).
- 2026-05-27: Use server-generated per-join `session_id` and reject commands from non-active session ids.
- 2026-05-27: Keep active-session ownership in-memory only (no persistence).
- 2026-05-27: `PlayerServer` is the owner of takeover/session state and orchestration.
- 2026-05-27: Preserve ACK/replay semantics across takeover; pending unacked results transfer to the new active tab.
- 2026-05-27: No offline `player.projection.tick` buffering; catch up via authoritative projection on next join.
- 2026-05-27: Clear local snapshot cache when `session.superseded` is received.
- 2026-05-27: Superseded tab switches immediately (next frame) to shutdown-only rendering.
- 2026-05-27: Shutdown copy is exact and only `This session was opened in another tab.`
- 2026-05-27: Superseded tab immediately cancels pending retry loops (including `claim_not_ready` waits).
- 2026-05-27: Add `session_superseded` to documented command error reasons in this same phase.
- 2026-05-27: Takeover is orchestrated by `PlayerServer` via direct old channel pid (push then disconnect) for deterministic ordering.

## Acceptance
- Idle connected player sees `soil` and token visibility updates without sending commands.
- Progress reward claim flow remains non-blocking and still retries on `claim_not_ready` using `can_claim_in`.
- Pending claim resolution does not exit early; progress bar remains visually at `0%` during the wait window.
- No durable state transition occurs from push events.
