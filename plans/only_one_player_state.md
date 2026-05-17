# Refactoring: One Player State (Remove Save Slots)

> **BREAKING RESET** — Per AGENTS.md, no backward compatibility is needed.
> Run `mix ecto.reset && MIX_ENV=test mix ecto.reset` after updating the migration.

## Summary

The project currently gives each player **4 save slots** (`save_slots` table, `slot_index 0..3`).
The player has an `active_save_slot` pointer, and commands like `save_slot.switch` / `save_slot.reset`
/ `save_slots.list` let the player juggle between them. This adds considerable complexity to
persistence, the command executor, the PlayerServer, snapshots, the wire protocol, and the frontend.

**Goal:** Each player has exactly **one** game state. No slot selection, no switching, no summaries.

---

## Phase 1 — Database Migration

Update the existing migration in-place (migration hygiene rule).

### `priv/repo/migrations/20260507010000_create_game_schema.exs`

#### `players` table
- **Remove** column `active_save_slot`.

#### `save_slots` table → rename to `player_states`
- **Remove** column `slot_index`.
- **Remove** unique index on `[:player_id, :slot_index]`.
- **Remove** check constraint `save_slots_slot_index_range`.
- **Add** unique index on `[:player_id]` (one state per player).
- Rename table from `save_slots` to `player_states`.

#### `game_commands` table
- **Change** `save_slot_id` → `player_state_id`, referencing `player_states`.

After editing, run:
```bash
mix ecto.reset && MIX_ENV=test mix ecto.reset
```

---

## Phase 2 — Backend Persistence Layer

### 2A. Rename `SaveSlot` → `PlayerState` (schema)

**File:** `lib/incrementalist/game/persistence/save_slot.ex` → `player_state.ex`

- Rename module `Incrementalist.Game.Persistence.SaveSlot` → `Incrementalist.Game.Persistence.PlayerState`.
- Change schema to `"player_states"`.
- **Remove** `field :slot_index`.
- **Remove** `validate_required([:slot_index])`, `validate_inclusion(:slot_index, ...)`, `unique_constraint([:player_id, :slot_index])`.
- Keep: `:player_id`, `:state` (embeds_one), `:notices` (embeds_one), `:has_daily_token`, `:last_saved_at`, `belongs_to :player`, timestamps.
- Keep `inject_state_tokens/1` and `extract_state_tokens/1` unchanged.

### 2B. Replace `SaveSlots` → `PlayerStates` (queries module)

**File:** `lib/incrementalist/game/persistence/save_slots.ex` → `player_states.ex`

Rename module to `Incrementalist.Game.Persistence.PlayerStates`. Simplify:

| Old function | New function | Notes |
|---|---|---|
| `ensure_four_slots/2` | `ensure_state/2` | Insert one row if missing, on_conflict: nothing |
| `get_slots/1` | *(remove)* | Not needed |
| `get_slot/2` | `get/1` | Takes `player_id`, no slot_index |
| `get_slot!/2` | `get!/1` | Takes `player_id` |
| `determine_active_slot/2` | `load_or_create/2` | Gets or creates the single state row |
| `initialize_if_empty/2` | *(keep, simplify)* | Same logic, no slot selection |
| `autosave/2` | *(keep)* | Operates on the single state |
| `reset/2` | *(keep)* | Resets the single state |
| `switch_player_to_slot/3` | *(delete)* | No switching |
| `summaries/2` | *(delete)* | No summaries |
| `snapshot_for_player/2` | *(keep, simplify)* | Calls `load_or_create` |

### 2C. Update `Player` schema

**File:** `lib/incrementalist/game/persistence/player.ex`

- **Remove** `field :active_save_slot`.
- **Remove** from `changeset` cast/validate_required/validate_inclusion.
- The `has_one :player_state` association is optional but nice for preloading.

### 2D. Update `GameCommand` schema

**File:** `lib/incrementalist/game/persistence/game_command.ex`

- Rename `belongs_to :save_slot, SaveSlot` → `belongs_to :player_state, PlayerState`.
- Rename field accordingly in changeset cast list (`:save_slot_id` → `:player_state_id`).

---

## Phase 3 — Backend Session / Executor / Snapshots

### 3A. `PlayerServer`

**File:** `lib/incrementalist/game/session/player_server.ex`

- Rename all `active_slot` references to `player_state` in internal state map.
- `refresh_session_state/2`: call `PlayerStates.load_or_create` instead of `SaveSlots.determine_active_slot`.
- `boot_player` handler:
  - Remove `cached_save_slots` parameter. The snapshot cache should still work but is keyed by player, not slot.
  - Remove `active_save_slot` from boot payload.
  - Remove `save_slot` summary from boot payload.
  - Simplify `snapshot_unless_cached` (no slot index to check; use a boolean `has_cached_snapshot`).
- Remove `@save_boundary_types` — `save_slot.switch` is gone. `save_slot.reset` can stay as a regular non-boundary command renamed to `game.reset`.
- `save_active_slot` → `save_player_state`.

### 3B. `CommandExecutor`

**File:** `lib/incrementalist/game/command_executor.ex`

- **Delete** command handlers: `"save_slots.list"`, `"save_slot.switch"`, `"save_slot.reset"`.
- **Add** command handler: `"game.reset"` — resets the single player state (replaces `save_slot.reset`).
- `active_slot/2` → `player_state/2` — calls `PlayerStates.load_or_create`.
- Every `active_slot.id` → `player_state.id` in the return tuples.
- Every `active_slot.state` → `player_state.state`.
- Every `active_slot.notices` → `player_state.notices`.
- `update_active_slot/2` → `update_player_state/2`.
- **Delete**: `execute_switch/3`, `execute_reset/3`, `fetch_slot_index/1`, `normalize_slot_index/1`, `cached_snapshot_hint?/1`, `maybe_put_snapshot/4`, `clear_commands_after_save_boundary!/3`.

### 3C. `Snapshots`

**File:** `lib/incrementalist/game/snapshots.ex`

- Remove `active_slot_index` parameter from `full/3` → `full/2`.
- Remove `"active_save_slot"` from the snapshot map.
- Remove `"save_slot"` summary from the snapshot map.

### 3D. `State`

**File:** `lib/incrementalist/game/state.ex`

- **Delete** `summary/2` function entirely (slot summaries are gone).

### 3E. `Sessions`

**File:** `lib/incrementalist/game/sessions.ex`

- `create_player/1`: call `PlayerStates.ensure_state` instead of `SaveSlots.ensure_four_slots`.
- `refresh_player/2`: call `PlayerStates.ensure_state` instead of `SaveSlots.ensure_four_slots`.
- Remove the `cached_save_slots` parameter from `boot_player/3` (delegate simplification).

### 3F. `Constants`

**File:** `lib/incrementalist/game/constants.ex`

- **Delete** `max_save_slots/0` and `valid_slot_indexes/0`.

---

## Phase 4 — Wire Protocol Simplification

### 4A. Remove from boot payload

Currently the boot payload includes:
- `active_save_slot` → **remove**
- `save_slot` (summary) → **remove**

### 4B. Remove from snapshot payload

- `active_save_slot` → **remove**
- `save_slot` (summary) → **remove**

### 4C. Remove command types from protocol

| Removed command | Replacement |
|---|---|
| `save_slots.list` | *(none)* |
| `save_slot.switch` | *(none)* |
| `save_slot.reset` | `game.reset` |

### 4D. Remove from error reasons

- `slot_index_required`, `invalid_slot_index` → **remove**

---

## Phase 5 — Frontend Changes

### 5A. Protocol types

**File:** `assets/src/net/protocol.ts`

- **Delete** `SaveSlotSummary` type.
- **Delete** `SaveSlotsListResult` type.
- **Delete** `SaveSlotSwitchResult` type.
- **Delete** `SaveSlotResetResult` type.
- **Add** `GameResetResult` type (snapshot + server_time).
- Remove `active_save_slot` from `GameSnapshot`.
- Remove `save_slot` from `GameSnapshot`.
- Remove `active_save_slot` from `BootResult`.
- Remove `save_slot` from `BootResult`.
- Remove `active_save_slot` from `CommandErrorResult`.
- Remove `slot_index_required` and `invalid_slot_index` from `CommandErrorReason`.
- Update `AckableCommandResult` union: remove deleted types, add `GameResetResult`.
- Update `isAckableCommandResult`: remove deleted type checks, add `game.reset.result`.

### 5B. Commands

**File:** `assets/src/net/commands.ts`

- **Delete** `listSaveSlots`, `switchSaveSlot` functions.
- **Rename** `resetSaveSlot` → `resetGame` (sends `"game.reset"`).
- Remove imports: `SaveSlotsListResult`, `SaveSlotSwitchResult`, `SaveSlotResetResult`.
- Add import: `GameResetResult`.

### 5C. Snapshot state / applyResult

**File:** `assets/src/net/snapshots.ts`

- Remove `slots: SaveSlotSummary[]` from `ServerState`.
- Remove `SaveSlotSummary` import.
- Remove all `state.slots` / `upsertSlot` logic.
- Remove `snapshotFromResult` cases for `save_slot.switch.result`.
- Update `snapshotFromResult` for `game.reset.result`.
- Remove status messages for deleted command types.
- Add status for `game.reset.result`.

### 5D. Snapshot cache

**File:** `assets/src/net/snapshot-cache.ts`

- Simplify: one key per username, no slot index dimension.
- Remove `slotCount`, `cachedSlotIndexes()`.
- `load()` takes no slot index.
- `save()` uses a flat key.
- `isUsableSnapshot` drops the `active_save_slot` check.

### 5E. Game channel

**File:** `assets/src/net/game-channel.ts`

- Remove `cachedSaveSlots` constructor parameter.
- Remove `cached_save_slots` from connection URL params.

### 5F. Game client

**File:** `assets/src/core/game-client.ts`

- Remove `switchSaveSlot`, `listSaveSlots` imports and usage.
- Rename `resetSaveSlot` → `resetGame`.
- Remove the `onSwitch` action from `mainMenu.setActions`.
- Simplify `onReset` to call `resetGame`.
- Remove post-boot `listSaveSlots` call.
- `onBootResult`: remove `result.active_save_slot`, `result.save_slot`, `state.slots`.
- `hydrateSnapshotFromCache`: simplify (no slot switching).
- `cacheSnapshotFromResult`: remove switch/slot cases, just cache snapshot for player.
- `applyAndAck`: remove `save_slot.switch.result` / `save_slot.reset.result` checks, add `game.reset.result`.
- `clearsCommandQueue`: return true only for `game.reset.result`.

### 5G. Save files UI

- **Delete** entire file: `assets/src/ui/layout/main-menu/panels/save-files.ts`.
- **Delete** entire file: `assets/src/ui/components/cards/save-slot.ts`.
- Remove the `save` tab definition from `assets/src/ui/layout/main-menu/view-model.ts`.
- Remove `SaveSlotActions` type and `setSaveSlotActions`/`getSaveSlotActions` functions.
- In `assets/src/ui/layout/main-menu/render.ts`: remove `setActions` method and `SaveSlotActions` import.
- In `assets/src/core/game-client.ts`: remove `this.mainMenu.setActions(...)` block.
- Add a simple "Reset Game" button somewhere in the menu (e.g., in the Stats tab or a new Settings tab).

### 5H. User socket

**File:** `lib/incrementalist_web/user_socket.ex`

- Remove `cached_save_slots` from socket assigns.
- Remove `cached_save_slots/2` and `parse_cached_save_slots/1` helper functions.
- Remove `cache_username` / `cached_save_slots` from `connect/3` params handling.

### 5I. Game channel (backend)

**File:** `lib/incrementalist_web/channels/game_channel.ex`

- Remove `socket.assigns.cached_save_slots` from `join/3`.
- Simplify `Sessions.boot_player` call (no cached_save_slots).

---

## Phase 6 — AGENTS.md Updates

Update the following sections in `AGENTS.md`:

- **Persistence Rules**: Remove "Players have 4 save slots" → "Each player has one game state".
- **`PlayerServer` / DB Rules**: Remove `save_slot.switch` / `save_slot.reset` from save-boundary references.
- **Client/Server Protocol Rules**: Remove save slot references from the protocol contract description.
- **Constants Rule**: The `max_save_slots` / `valid_slot_indexes` constants are deleted; no rule needed.

---

## Phase 7 — Tests

### Update test files:

| File | Changes |
|---|---|
| `test/incrementalist/game/sessions_test.exs` | Remove "four slots" assertions. Assert single state row creation. |
| `test/incrementalist/game/commands_test.exs` | Delete `save_slot.switch`/`save_slot.reset` tests. Delete slot selection/boot tests. Add `game.reset` test. Simplify `create_player` helper. Remove `put_player_active_slot`/`put_slot_state` helpers. |
| `test/incrementalist_web/user_socket_test.exs` | Remove both `cached_save_slots` tests. Add simple connect test without slot caching. |

---

## Verification Checklist

- [ ] `mix ecto.reset && MIX_ENV=test mix ecto.reset` — no errors
- [ ] `mix test` — all tests pass
- [ ] `cd assets && npx tsc --noEmit` — no TypeScript errors
- [ ] `cd assets && npm run build` — frontend builds cleanly
- [ ] Boot a fresh player → single state created, snapshot returned without slot metadata
- [ ] `game.reset` command resets the single state and returns a fresh snapshot
- [ ] No `slot_index`, `active_save_slot`, `save_slot`, or `slots` appear in any wire payload
- [ ] No `SaveSlot`, `save_slot`, `slot_index` references remain in active code (only migration file)
- [ ] AGENTS.md rules are updated
