# Suggestion: Move Command Execution Fully Into `PlayerServer`

## Context
The current `PlayerServer` implementation already owns the boot path, active save-slot mirror, and a small replay buffer for reconnects. However, the actual gameplay command execution path still lives in `lib/incrementalist/game/commands.ex`, where it continues to take a `FOR UPDATE` lock on the `players` row and performs queue mutation inside database transactions.

That means the GenServer is only partially adopted:
1. Boot and reconnect use the in-memory session mirror.
2. Command enqueue and ack still depend on the legacy DB-serialized queue path.
3. The system still pays the row-lock cost on the hot path.

## Problem
This split leaves the architecture in an awkward halfway state.

- The server owns truth for boot and reconnect, but not for live command execution.
- The queue logic still serializes through Postgres, which defeats the performance goal of the GenServer-per-player model.
- Session state can drift between the in-memory mirror and the database-backed executor unless every command is carefully synced after the fact.

That is fragile and hard to reason about. The next step should be a clean cutover so `PlayerServer` becomes the single sequential authority for live player actions.

## Proposed Solution
Move the full command execution pipeline into `Incrementalist.Game.Session.PlayerServer`.

The GenServer should own:
1. Command acceptance and queue backpressure.
2. FIFO sequencing for the active player.
3. In-memory execution of game rules through `CommandExecutor`.
4. Replay of unacked and recently completed results.
5. Durable persistence of command rows and save-slot state as a side effect, not as the coordination mechanism.

`lib/incrementalist/game/commands.ex` should then shrink into a compatibility-free thin facade or disappear entirely if nothing else needs it. The final shape should be:

- `GameChannel` sends player intent to `PlayerServer`.
- `PlayerServer` validates the command id, decides whether to queue, replay, or execute, and updates its own state.
- Persistence happens asynchronously for command audit rows, but save-slot state still flushes synchronously at the required boundaries.

## Implementation Plan
1. Move the enqueue path into `PlayerServer`.
   - Add a `handle_call({:enqueue, command_type, intent}, ...)` implementation that performs the current command validation, FIFO sequencing, and execution inside the GenServer.
   - Keep command ids as client intent only.
   - Preserve the current server-owned queue limit and save-boundary blocking rules.

2. Move ack handling into `PlayerServer`.
   - Add a `handle_call({:ack, command_id}, ...)` implementation that only acknowledges the current blocking result.
   - Maintain the bounded replay buffer in memory.
   - Make replay-by-sequence work from memory first, not from the database.

3. Remove live command execution from `lib/incrementalist/game/commands.ex`.
   - Reduce it to a transition shim only if the codebase still needs a module-level API during the migration.
   - Eliminate the `FOR UPDATE` lock path from the live command flow.
   - Do not add compatibility layers, alternate queue modes, or fallback paths.

4. Make persistence follow the in-memory state.
   - Persist completed command rows asynchronously for audit/history.
   - Flush save-slot state synchronously on the required boundaries: deliberate disconnect, idle timeout, save-slot switch, save-slot reset, and shutdown.
   - Keep the authoritative in-memory state and the persisted state aligned through explicit session sync points.

5. Route the channel through the GenServer.
   - Update `GameChannel` so command events call `PlayerServer` directly.
   - Keep boot, reconnect, and disconnect handling consistent with the server-owned session model.

6. Add regression coverage.
   - Prove commands execute once only even when replayed or retried.
   - Prove reconnect boot can recover from the in-memory buffer without consulting the database.
   - Prove save-boundary commands still block follow-up commands correctly.
   - Prove no hidden outcomes are serialized to the client.

## Verification
After the cutover:
1. Run the full Elixir test suite.
2. Add or update backend tests for queue ordering, ack gating, reconnect replay, and save-slot boundaries.
3. Confirm the codebase no longer relies on `FOR UPDATE` for the active gameplay command path.
4. Confirm boot and reconnect still return only allowed visible data.

## Notes
- This migration should be done as a clean replacement, not as a hybrid long-term architecture.
- Do not add backwards compatibility shims.
- If a conflict appears between the GenServer model and the legacy queue path, prefer the GenServer model and remove the legacy branch instead of preserving both.

# Clarifications of end state

## Save file state

1. Maintain the active save file state inside the player `GenServer`.

2. Persist the active save file state synchronously in the following cases:

   * Deliberate player disconnect
   * Idle timeout after 10 minutes
   * Before server shutdown, restart, or deployment
   * Player save file switch
   * Player save file reset

3. Treat save file persistence as critical-path persistence.

4. Prioritize data integrity over performance for save file persistence.

5. Ensure save file data is fully persisted before completing any operation that depends on the saved state being durable.

## Commands

1. Persist completed commands asynchronously.

2. Treat command persistence as audit logging rather than critical state persistence.

3. Prioritize runtime performance over command persistence latency.

4. Do not require command persistence to complete before continuing normal gameplay flow.

5. Delete commands older than 24 hours once per day.

## Reconnection and command replay

1. Do not terminate the `PlayerServer` immediately on unexpected player disconnect.

2. Start a 10-minute idle timeout when the player disconnects unexpectedly.

3. If the player reconnects within the idle timeout window, reattach them to the existing `PlayerServer`.

4. Maintain a small bounded in-memory buffer in the `GenServer` state containing the last 10 completed commands.

5. Each buffered command result must include enough information to identify and replay it, such as:

   * `command_id` or sequence number
   * command result
   * completion status
   * any relevant response payload

6. When a client reconnects, require the client to provide its last known `command_id` or sequence number.

7. On reconnect, replay any completed command results from the in-memory buffer that occurred after the client’s last known `command_id` or sequence number.

8. Replay missed command results from memory without querying the database when they are still available in the buffer.

9. Preserve once-only command execution semantics during reconnects.

10. Never re-execute a completed command merely because the client did not acknowledge its result.

11. If missed command results are no longer available in the in-memory buffer, handle recovery using the defined fallback behavior rather than re-executing commands.

12. Command persistence may remain asynchronous even though reconnect replay uses the in-memory command result buffer.

