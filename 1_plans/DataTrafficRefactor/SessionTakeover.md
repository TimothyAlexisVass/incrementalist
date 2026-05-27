# Session Takeover Plan

## Goal
Enforce single-tab active gameplay per player with deterministic server-owned takeover, while preserving command FIFO/replay/ACK guarantees.

## Scope
In scope:
- One active game session per player at a time.
- Server-issued per-join `session_id`.
- Immediate takeover at `game` channel join boundary.
- Superseded tab shutdown via push + disconnect.
- Hard-lock superseded tab until manual reload.
- Server-side command rejection for superseded sessions.

Out of scope:
- Minute projection push cadence/content (`player.projection.tick` payload design).
- Climate/global push behavior.
- Gameplay reward logic changes unrelated to session ownership.

## Event Contract (v1)
Event name:
- `session.superseded`

Payload:
- `type: "session.superseded"`
- `server_time: ISO8601 UTC`
- `reason` (machine-readable; e.g. `new_session_activated`)

Rules:
- No ACK.
- Supersede ordering is strict: push `session.superseded` first, then disconnect old socket/session.
- Client renders fixed local message only (no server display copy): `This session was opened in another tab.`
- After apply, old tab ignores all push and command-result traffic and remains locked until manual reload.
- Superseded tab switches on next frame to shutdown-only rendering (no lingering gameplay/cosmetic animation).
- Superseded tab cancels active loops immediately (including pending `claim_not_ready` waits).

## Session Identity and Ownership
- Each websocket join receives a server-generated `session_id`.
- Commands are accepted only from the currently active `session_id` for that player.
- Active ownership is in-memory only (node-local, reset on restart), with no DB persistence.
- Ownership/orchestration lives in `PlayerServer` (active `session_id`, owning channel pid, takeover/disconnect flow).
- Pending processed-but-unacked command results remain replayable and must transfer to the new active session after takeover.

## Backend Work
1. Generate/assign server `session_id` at `game` join.
2. Register active session ownership in `PlayerServer` by `(player_id -> session_id + channel pid)`.
3. On new join for same player, supersede old session by direct old-channel pid orchestration.
4. Push `session.superseded` to old tab, then disconnect old socket/session immediately.
5. Reject commands from non-active session ids with `command.error` reason `session_superseded`.
6. Keep queue/dedupe/FIFO/replay/ACK behavior unchanged under takeover.
7. Extend documented command error reasons to include `session_superseded`.

## Frontend Work
1. Add typed handling for `session.superseded`.
2. On receipt, clear local snapshot cache before entering locked state.
3. Render only shutdown message on `#incrementalist`: `This session was opened in another tab.`
4. Stop gameplay updates, inputs, push handling, and command-result processing after supersede.
5. Prevent auto-reconnect/reactivation after supersede; only manual reload may rejoin.
6. Cancel pending async claim retry loops and similar timers immediately.

## Acceptance
- Opening a second tab immediately activates the new tab and supersedes the old tab at join boundary.
- Old tab receives `session.superseded`, renders only shutdown message next frame, and disconnects.
- Old tab stays locked and does not auto-reconnect.
- Commands from superseded session are rejected with `command.error` reason `session_superseded`.
- Pending unacked results remain replayable to the new active tab after takeover.
- No durable gameplay transition occurs from supersede push itself.

## Interview Decisions
- 2026-05-27: Single-tab play is mandatory; new tab wins at join boundary.
- 2026-05-27: Dedicated `session.superseded` push event is used for shutdown.
- 2026-05-27: Payload is machine-readable (`reason`), display copy stays client-local and fixed.
- 2026-05-27: Supersede sequence is push then disconnect for deterministic ordering.
- 2026-05-27: Superseded tab remains hard-locked (no auto-reconnect) until manual reload.
- 2026-05-27: Server enforces identity via per-join `session_id` and rejects superseded commands.
- 2026-05-27: Session ownership is in-memory only and owned by `PlayerServer`.
- 2026-05-27: ACK/replay semantics are preserved across takeover.
