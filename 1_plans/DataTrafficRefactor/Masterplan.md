## Data Traffic Refactor Masterplan

### Goal
Move recurring world/player updates from request-driven pulls to server-driven websocket pushes, while keeping command/result for durable gameplay actions.

### Why
Recurring world/player state should advance by UTC boundary rules even when the player sends no commands, with minute-level push cadence for fresher projection updates.

### Non-negotiable Constraints
- Server owns truth; client only projects/renders.
- All interval/boundary logic is UTC.
- Client must continue syncing local clock from `server_time`.
- Command idempotency + ACK flow stays authoritative for gameplay commands.
- No backward-compat shims; reset/migrate cleanly if protocol breaks.

### Target Communication Model
| Mode | Direction | Purpose | ACK | Durable game transitions |
| --- | --- | --- | --- | --- |
| `player push` | Server -> one client | Recurring per-player ticks (climate/soil/plots/etc.) | No | No |
| `command/result` | Client -> server -> client | Player intent + authoritative execution result | Yes (existing) | Yes (only mode) |

### Event Contracts (v1)
#### 1) Player Tick Event
- Event name: `player.tick`
- Payload:
  - `type: "player.tick"`
  - `server_time` (ISO8601 UTC)
  - `climate` (same visible shape as snapshot)
  - `soil` (visible soil state)
  - `plots` (visible plots state)
  - `has_bonustime_token` (boolean, optional; change-only or on reconnect/re-sync)
- Cadence: every UTC minute boundary (`...:00.000Z`) aligned to absolute time, not process-relative intervals.
- Climate minute rules:
  - Push full `climate` every minute.
  - `rain_mm` uses per-minute distribution (hourly weather amount split across 60 minute ticks).
  - `rain_mm` remains decimal in server/state math; UI displays integer-formatted rain values.
  - `c` fluctuates each minute within `base_temp ± 2C` using deterministic integer jitter.
  - `c` jitter is not clamped to season min/max bounds.
  - Temperature jitter is keyed by UTC minute index only (global shared value per minute for all players).

#### 2) Command/Result
- No change to semantics.
- Remains the only lane that can cause durable transitions.

### Backend Plan
1. Add push-event allowance to protocol docs/AGENTS (explicit exception to command/result-only for non-durable recurring ticks).
2. Add global `ClimateCache` to compute/cache climate per UTC minute index.
3. Add per-player recurring tick scheduling in `PlayerServer` at UTC minute boundaries.
4. Route push events through channel process using PubSub fanout + Phoenix push.
5. Keep command pipeline untouched (queue, dedupe, FIFO, replay, ACK).
6. Refactor climate + orchard projection from hourly-step assumptions to UTC minute-step behavior aligned with minute ticks.

### Frontend Plan
1. Extend socket message handling to process server-pushed events.
2. Add typed handling for `player.tick`.
3. Merge push payloads through centralized authoritative apply path (`applyAuthoritativeData` + area view-model refresh), no ad-hoc mutations.
4. Maintain `synchronize(server_time)` on every push event.
5. Keep command flow as-is.

### Rollout Phases
1. **Protocol + Docs**
   - Define event payload contracts.
   - Update AGENTS/protocol doc exception language.
2. **Transport Plumbing**
   - Backend push wiring + frontend push receiver.
3. **Player Tick Live**
   - Ship `player.tick` for climate/soil/plots/recurrence.
4. **Immediate Cutover**
   - Remove scheduled hourly `time.sync` fallback immediately when minute push lanes land.
   - Remove dead retry/polling logic in the same change.
5. **Reset/Migrate Dev Data**
   - Reset DB/state as needed to align with the new protocol and authority model.

### Safety and Ordering Rules
- Push events are replace/merge updates only, never command execution.
- Ignore stale push events only when `server_time` is strictly older than last applied (`<`). Equal timestamps are accepted.
- Reconnect behavior stays snapshot-first; pushes resume after join.

### Testing Plan
- Backend:
  - Unit tests for UTC boundary scheduling for player ticks.
  - Channel tests proving push event emission format.
- Frontend:
  - Unit tests for push message parsing and state merge.
  - Tests proving stale push rejection and `server_time` sync behavior.
- Integration:
  - Idle session test: after >1 hour, climate + soil update without user commands.

### Open Questions & Decisions
1. Should `global.tick` and `player.projection.tick` share one event (`projection.tick`) with scoped payload, or stay separate for clarity?
   - Decision: Combine into a single `player.tick` event to guarantee absolute ordering, simplify payloads, and prevent race conditions.
2. Should PlayerServer push strictly hourly only, or also at non-hour recurring boundaries (e.g. BonusTime slot boundaries) in same lane?
   - Decision: Push `player.tick` every UTC minute boundary.
3. Where do we want the formal protocol spec kept long-term (`AGENTS.md` only vs dedicated `shared/protocol` doc)?
   - Decision: Keep canonical wire contracts in a dedicated protocol doc (e.g. `shared/protocol/game-push.md`) and keep AGENTS as summary + pointer.
4. Should BonusTime token grant move off the `BonusTimeGrant` bulk DB worker and become boundary-derived in the new minute-tick architecture?
   - Decision: Yes. Use boundary-index-derived token authority (server-computed), remove mass grant writes.
5. Should `active_game_id` be sent to client in push/snapshot/command results?
   - Decision: No. `active_game_id` is derived client-side from synchronized server time and kept server-internal for command validation.
6. What transport pattern should carry push events to sockets?
   - Decision: PubSub fanout. `GameChannel` subscribes on join and relays via `push/3`; PlayerServer broadcasts to player topic.
7. How should stale push filtering compare timestamps?
   - Decision: Treat only strictly older `server_time` as stale; accept equal timestamps.
8. Should token granting remain in `State.check_daily_reset/2`?
   - Decision: No. Remove token mutation from `State.check_daily_reset/2`; token availability must come only from boundary-index-derived server authority.
9. How should `bonustime_flips` reset after removing `BonusTimeGrant`?
   - Decision: Reset `bonustime_flips` when the player receives their `its_bonus_time` reward (in-command reward resolution), not on boundary timers.
10. Should hourly `time.sync` fallback remain during rollout?
    - Decision: No. Immediate cutover; remove scheduled fallback and reset dev data as needed.
11. Should `has_bonustime_token` be included every minute in `player.tick`?
    - Decision: No. Push `has_bonustime_token` only when it changes.
12. Should `projection_params` move into push paths?
    - Decision: No. `projection_params` remain command-driven and are out of scope for push lanes.
13. Should per-minute temperature fluctuation be deterministic or runtime-random?
    - Decision: Deterministic per UTC minute.
14. How should minute rain values be represented/displayed?
    - Decision: Keep decimal `rain_mm` in authoritative/server projection; UI displays integer-formatted rain.
15. Should command results continue auto-including `climate` and `soil` after push cutover?
    - Decision: No. `climate`/`soil` move to push lanes; command results carry only command-authoritative fields.
16. Should boot snapshot still include `climate` and `soil`?
    - Decision: Yes. Keep both in boot snapshot for immediate first-frame correctness; push lanes take over after join.
17. How should boundary-derived BonusTime token grants behave for offline players and missed boundaries?
    - Decision: Token remains a single non-stacking boolean. Offline players still receive eligibility on next server contact based on boundary-index comparison.
18. How should UTC daily rollover interact with BonusTime token grants?
    - Decision: Keep daily rollover for stats only; remove token grant mutation from daily rollover logic.
19. Should orchard dry-down/leaching remain hourly-step or move to minute-step?
    - Decision: Move to minute-step. Apply rain, dry-down, and water-loss-driven leaching each minute using minute-scaled rates.
20. Should minute temperature jitter be integer or decimal?
    - Decision: Integer jitter only.
21. Should minute ticks be absolute UTC boundaries or relative 60s intervals?
    - Decision: Absolute UTC minute boundaries (`...:00.000Z`).
22. Should `soil` be change-only or always included on player minute ticks?
    - Decision: Always include full `soil` and `plots` on every minute `player.tick`.
23. Should minute temperature jitter be clamped to seasonal min/max bounds?
    - Decision: No. Allow jittered temperature to exceed seasonal bounds.
24. Should minute temperature jitter be player-specific or globally shared?
    - Decision: Globally shared. Derive from UTC minute index only.
