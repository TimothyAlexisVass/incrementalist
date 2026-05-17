# Command Queue & Idempotency Review Report

This document contains an end-to-end evaluation of the command queue and idempotency mechanisms in the project, fulfilling the requirements for Step 3 of the full review.

## 1. In-Flight Command Gating & Queue Limit
- **Client implementation**: In `assets/src/net/game-channel.ts`, `commandQueueLimit` is set to `10`. `commandQueue` is initialized as a 10-slot boolean array: `Array<boolean>(commandQueueLimit).fill(false)`.
- **Gating**: When `reserveCommandId()` is called, it searches for the first `false` index. If all slots are true, it throws an error: "Command queue is full", preventing further command dispatches.
- **Queue Limits**: Only indices 0 through 9 are used. Out-of-bounds `command_id` values in `trackCommandResult` or `forgetCommand` simply return early.
- **Client-Side Persistence**: `commandQueue` is kept completely in the memory of the `GameChannel` class and is correctly never persisted to `localStorage`.
- **Status: Verified**. The client safely utilizes a 10-slot boolean array, rejects overflowing commands, and doesn't store queue limits across reloads.

## 2. Live Command Deduplication & Replay
- **Server implementation**: In `lib/incrementalist/game/session/player_server.ex`, `existing_pending_by_command_id(state, command_id)` detects if the `command_id` matches the current `state.unacked_command` or any in `state.queued_commands`.
- **Deduplication**: If a match is found in `unacked_command`, it calls `replay_unacked(state, command)` which increments the `replay_count` and immediately returns the cached `.result` without calling `CommandExecutor.execute` again.
- **Server Tests**: `test/incrementalist/game/commands_test.exs` contains tests (`test "stored results replay without re-executing command rules"`) verifying that duplicate commands merely increase the `replay_count` and return the original result.
- **Reconnect Handling**: On reconnection, `Sessions.boot_player` includes the unacked stored result by fetching it from `Commands.replay_pending(player_id)`.
- **Status: Verified**. Connection loss and deduplication safely replay cached results, properly gating re-execution.

## 3. FIFO GenServer Command Serialization
- **Server execution**: In `lib/incrementalist/game/session/player_server.ex`, commands that pass gating are pushed to the end of a list: `%{state | queued_commands: state.queued_commands ++ [command]}`.
- **Execution sequencing**: `process_next_queued(state, now)` removes the head of the `queued_commands` list and processes it with `execute_next(state, next, now)`.
- **Releasing Unacked**: When an `ack` is sent by the client, `handle_call({:ack, ...})` processes it. The server clears the `unacked_command` and then triggers `process_next_queued/2` to process the next queued command.
- **Status: Verified**. The GenServer successfully processes commands sequentially in strict FIFO order, ensuring atomic transitions without race conditions.

## 4. Database Persistence Hygiene
- **Sync player state**: Player states are persisted synchronously via `PlayerStates.autosave(player_state)`, executed in `save_player_state` at specific save boundaries.
- **Async command audit logs**: In `PlayerServer.ex`, `async_persist_completed_command(command)` and `async_mark_command_acked(command, now)` use asynchronous message passing (`send(self(), ...)`) when `@async_command_persistence` is enabled, avoiding slow DB calls blocking the GenServer logic.
- **Locking**: Row-level locking (`FOR UPDATE`) is avoided; concurrency control is fully offloaded to the sequential processing of the GenServer.
- **Status: Verified**. Transactions, synchronous updates, and asynchronous audits correctly guarantee system durability without sacrificing performance.

## Summary
The command queue and idempotency mechanisms have been reviewed and fully comply with the design and durability requirements.
