# Phase 10.1: Achievements Backend

## Goal
Implement the server-side logic for Achievements, including definition loading and condition evaluation.

## Tasks

### 0. Data Audit & Schema Sync
- Audit `shared/requirements/achievements.json`.
- Validate that all `stars` and conditions are properly defined.

### 1. Definition Loading
- Update `lib/incrementalist/game/constants.ex` to load `achievements.json`.
- Implement `achievement_defs/0`.
- **Normalization**:
  - Handle `stars` as normalized multipliers.

### 2. State Integration
- Update `Incrementalist.Game.State` to include:
  - `achievements`: A map of `id => unlocked_at` (UTC timestamp).

### 3. Evaluation Logic
- Create `Incrementalist.Game.Features.Achievements.Rules`:
  - `evaluate(state)`: Checks current state/stats against achievement conditions and unlocks new ones.
- Integration: Call achievement evaluation after relevant commands.

## Deliverable
Server successfully evaluates and unlocks achievements based on player progress.
