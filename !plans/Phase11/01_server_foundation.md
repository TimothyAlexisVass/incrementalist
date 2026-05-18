# Phase 11, Step 1: Server Foundation

## Objective
Establish the authoritative data structure and rules for the Daily Bonus (BONUSTIME) system on the server, ensuring parity with the legacy implementation's token mechanics, rotation, and stats tracking.

## Aesthetic Principle (Phase 11)
Implementations for all mini-games in this phase must be **visually basic and representational**. Use simple shapes (boxes, circles) and text labels rather than detailed sprites or complex animations. The goal is to claim layout space and prove logic before final visual polish.

## Implementation

### 0. Domain Data (Requirements)
- **File**: Create `shared/requirements/daily-bonus.json` (Done).
  - Define the 15-slot game rotation.
  - Define reward tiers (tier_1 through tier_7) with chances and rarities.
  - Define streak-based scaling (e.g., initial pick counts for Card Pick, roll counts for Chest Draw).
- **Constants**: Update `lib/incrementalist/game/constants.ex` to load and expose this data.

### 1. Schema Expansion
Modify the core database and Ecto schemas:
- **Table**: Add `has_daily_token` (Boolean, default false) to the `save_slots` table in `priv/repo/migrations/*_create_game_schema.exs`.
- **Ecto Schema**: Add `has_daily_token` to `lib/incrementalist/game/persistence/save_slot.ex`.
- **State Schema**: Add `bonustime` field to the `SaveSlot` state JSONB in `lib/incrementalist/game/state.ex` as an embedded schema:
- `special_tokens`: Integer (Persistent bonus attempts).
- `last_token_boundary_index`: Integer (Last boundary at which a token grant was evaluated).
- `streak`: Integer (Consecutive days played).
- `last_played_at`: ISO8601 Timestamp (To calculate streak gaps).
- `total_games_played`: Integer.
- `reward_counts`: Map (Tier ID -> Count).
- `checklist_entry_indexes`: Map (Resource/Item -> Next index).
- `active_session`: Map (Polymorphic embed with type/data for multi-step games).
- `last_result`: Map (Durable details of the most recent play, including reward_id and BigNum reward_amount).

### 2. Rules Implementation
Create `lib/incrementalist/game/features/bonustime/rules.ex`:
- **Scheduled Grant Job**: Implement a scheduled task (e.g., via a GenServer or Quantum) that runs every 12 hours.
  - Executes `UPDATE save_slots SET has_daily_token = true WHERE has_daily_token = false`.
  - Broadcasts a "boundary_reached" event to all active `PlayerServer` processes to synchronize their in-memory `State`.
- **Spending Logic**: Implement `spend_token(save_slot_or_state)`.
  - Prioritize spending `has_daily_token` before `special_tokens`.
- **Streak Management**: Implement `advance_streak(state, now)`.
  - Increment if played on a new UTC day.
  - Decrement by 3 **per missed day** if a day is skipped.
  - **Quest Integration**: Rename the `attendance` quest to `streak` in `shared/requirements/quests.json` and update its progress logic.
- **Game Selection**: Map `boundary_index` to the rotating game from requirements.

### 3. Constants
Update `lib/incrementalist/game/constants.ex` to provide accessors for the JSON data.
Define hardcoded timing and rotation constants:
- `bonustime_rotation_anchor_at`: Hardcoded global UTC boundary (e.g., 2024-01-01T00:00:00Z).
- `bonustime_slot_ms`: 43_200_000 (12 hours).
- `bonustime_rotation_slot_count`: 9.

## Verification
- Unit tests for token grant logic (especially the "grant only if 0" rule).
- Streak calculation tests with various day gaps.
- Rotation index correctness over multi-day spans.
- Persistence and serialization in snapshots.
