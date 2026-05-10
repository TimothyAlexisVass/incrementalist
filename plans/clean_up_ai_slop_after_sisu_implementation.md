# Plan: Clean up AI slop after Sisu implementation

The recent change to a cycle-based Sisu model has left behind redundant complexity, confusing naming, and AI-generated code smells. This plan outlines the items to be cleaned up.

## 1. Naming & Concept Alignment

### [Backend/Frontend] Rename `decay_per_second` to `cycle_decay`
- **Problem**: The variable is named `decay_per_second`, but it is actually a fraction (e.g., 0.05 for 5%) applied once per cycle. This is misleading and leftover from a previous model.
- **Fix**: Rename to `cycle_decay` in Ecto schemas, Elixir logic, and TypeScript view models/rendering.
- **Affected Files**:
    - `lib/incrementalist/game/state.ex`
    - `lib/incrementalist/game/features/progress/sisu.ex`
    - `assets/src/features/sisu/render.ts`
    - `assets/src/features/progress-bar/view-model.ts`

### [Frontend] Fix misleading UI units
- **Problem**: The UI displays `-%/s`, which implies a continuous decay. In the new model, the multiplier is fixed during the cycle.
- **Fix**: Change label to `-% / cycle` or similar, or simply show the "Next Cycle" target.
- **Affected Files**:
    - `assets/src/features/sisu/render.ts`

## 2. Redundant Projection Logic

### [Backend] Simplify `projection_params`
- **Problem**: The server sends `sisu_at_claim` and `sisu_decay_at_claim` just so the client can lerp them.
- **Fix**: If the client lerp is purely visual, the client can calculate these "target" values themselves using the same rules (`s_next = s * (1 - d)` and `d_next = d * 0.98`), reducing wire payload size.
- **Affected Files**:
    - `lib/incrementalist/game/state.ex`
    - `lib/incrementalist/game/features/progress/sisu.ex`

### [Backend] Consolidate Sisu Helpers
- **Problem**: `sisu.ex` has multiple overlapping helpers like `current_sisu_float`, `current_sisu_from_state`, etc.
- **Fix**: Standardize on a single set of accessors that handle the `BigNum` to `float` conversion and defaults consistently.

## 3. Code Quality & Slop Removal

### [Backend] Refactor `Levels.ex` Upgrade Costs
- **Problem**: `Levels.ex` contains a 1700+ line static array of upgrade costs. This is classic AI slop.
- **Fix**: Replace with a mathematical formula if possible (e.g., exponential growth) or at least a more compact generation logic. 
- **Note**: The Rule "Constants Rule" says constants must live in `constants.ex` or similar. Moving a 1700 line array there would be even worse. A formula is preferred.

### [Frontend] Remove Loop in `resolveClaimAsync`
- **Problem**: `interactions.ts` has an `async while` loop that retries `progressClaimReward` if the server says `claim_not_ready`. This is a dangerous pattern that can lead to infinite loops or race conditions.
- **Fix**: The client should wait for the `can_claim_at` time + a small buffer and send a single request. If it fails, the view-model already handles the retry logic via `shouldSendClaimIn`.
- **Affected Files**:
    - `assets/src/features/progress-bar/interactions.ts`

### [Frontend] Consolidate `UPGRADE_COST`
- **Problem**: The massive cost array is duplicated in `sisu/render.ts`.
- **Fix**: If the backend uses a formula, the frontend should use the same formula.

## 4. BigNum Hygiene

### [Backend/Frontend] Standardize Sisu Multiplier Handling
- **Problem**: `sisu.current` is a `BigNum`, but it's frequently converted to `float` for math.
- **Fix**: Ensure all math that *can* use `BigNum` (like `s * (1 - d)`) uses the library functions correctly, while keeping the final projection as a float where appropriate for rendering.

## Summary of Changes

1.  **Rename** all instances of `decay_per_second` to `cycle_decay`.
2.  **Update UI** labels from `%/s` to `% / cycle`.
3.  **Replace** the 1700-line cost array with a formula in both Elixir and TypeScript.
4.  **Remove** the retry loop in `resolveClaimAsync`.
5.  **Simplify** `projection_params` by removing redundant "at_claim" fields if possible.
6.  **Clean up** helper functions in `sisu.ex`.
