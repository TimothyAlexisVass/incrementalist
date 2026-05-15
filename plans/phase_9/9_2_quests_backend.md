# Phase 9.2: Quests Backend

## Goal
Implement the server-side logic for Quests, including definition loading, evaluation, and commands.

## Tasks

### 0. Data Audit & Schema Sync
- Audit `shared/requirements/quests.json`.
- Ensure the structure is consistent (e.g., `ranks` as maps with string keys).
- Validate that all `requirement` and `reward` values are compatible with `BigNum`.

### 1. Definition Loading
- Update `lib/incrementalist/game/constants.ex` to load `quests.json`.
- Implement `quest_defs/0`.
- **Normalization**:
  - Convert `reward` values to `BigNum` structs.
  - Convert `requirement` values to `BigNum` if they refer to currency or exp.

### 2. State Integration
- Update `Incrementalist.Game.State` to include:
  - `quests`: A map of `id => %{rank: integer, progress: number, claimed_rank: integer}`.
  - `stats`: Ensure historical data needed for quests is tracked.

### 3. Evaluation Logic
- Create `Incrementalist.Game.Features.Quests.Rules`:
  - `evaluate(state)`: Checks current state/stats against quest requirements and updates quest progress/rank.
- Integration: Call quest evaluation after relevant commands.

### 4. Commands
- `quest.claim`: Claims the reward for a specific quest rank.
- `quest.claim_all`: Claims all pending quest rewards.

## Deliverable
Server successfully tracks quest progress and handles claim commands.
