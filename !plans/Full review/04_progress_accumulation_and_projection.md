# Step 4: Progress Accumulation & Projection Review Plan

This step governs progress bar accumulation math, fill rates, Sisu scaling modifiers, local projection simulations, and active tier transitions.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Central Visual Loop (`updateProjectedFill`)**: Runs every animation tick inside `assets/src/core/game-client.ts`. When in the `projecting` state, it visually updates `projectedFill` by interpolating between `snapshotFill` and `100%` using `getServerNow()`.
- **Interpolation Parameters**:
  - `visualDuration = totalDuration - IDLE_MODE_BUFFER` (early 100% visual fill in idle mode to show rewards glowing).
  - `visualProgress = elapsed / visualDuration`.
  - Lerps progress bar: `projectedFill = snapshotFill + (100 - snapshotFill) * visualProgress`.
  - Lerps Sisu: `sisu = currentSisu + (targetSisu - currentSisu) * visualProgress`.
- **Centralized Snapshot State Merger**: `getStateFromSnapshot(snapshot)` (`assets/src/features/progress-bar/view-model.ts`) parses the incoming server projection values safely.

### Server (Elixir)
- **Base Fill Rate Sourcing (`base_progress_bar_fill_rate`)**:
  - `idle_mode: true` -> Uses `Constants.progress_bar_base_idle_mode_on_fill_rate()` (slower base rate).
  - `idle_mode: false` -> Uses `Constants.progress_bar_base_idle_mode_off_fill_rate()` (faster base rate).
  - Level-based new player multipliers:
    - Level < 3: Base rate is boosted by `progress_bar_new_player_bonus_fill_multiplier` and `progress_bar_new_player_bonus_fill_bonus`.
    - Level < 35: Base rate is boosted by `progress_bar_late_new_player_bonus_fill_multiplier`.
- **Effective Fill Rate Sourcing**: Multiplies base fill rate by `sisu_multiplier(state)`.
- **Authoritative Projection Sourcing (`ensure_can_claim_at`)**: Uses Sisu projections to assign `can_claim_at` and `cycle_started_at` timestamps.

---

## Step-by-Step Execution Verification Plan

### 1. Visual Progress Lerping Verification
- **Verify**: The visual fill bar grows smoothly at the correct speed and does not stutter or teleport between frames.
- **Verify**: Hovering over the progress bar displays a tooltip with accurate percentage and time-left values.
- **Verify**: The tooltip's estimation is derived exclusively from `canClaimInMs`, `nextVerifyAtMs`, or `canClaimAt` timestamps synchronized with `getServerNow()`.

### 2. Idle Mode Mode Transitions
- **Verify**: Toggle the IDLE / ACTIVE toggle.
- **Verify**: The bar resets completely upon toggle (as per server requirement `{:ok, %{state | idle_mode: enabled, can_claim_at: nil, cycle_started_at: nil}}`).
- **Verify**: The base progression rate adapts immediately to the selected mode.
- **Verify**: Idle mode reaches 100% visual fill 3 seconds early (`IDLE_MODE_BUFFER = 3000`) so the yellow/purple glowing visual effect plays before auto-collection.

### 3. Level-Scale Bonus Multipliers
- **Verify**: Create a new account (Level 1).
- **Verify**: The progress bar fills significantly faster due to active level-scale bonuses.
- **Verify**: Level up past 3, and then past 35.
- **Verify**: The base fill rates degrade seamlessly down to their authoritative constants.

### 4. Sisu Multiplier Projection
- **Verify**: When active Sisu values are high, the fill rate is multiplied correctly.
- **Verify**: Sisu visual projection matches its numerical value, diminishing slowly along the decay curve towards the target amount as visual progress increases.
- **Verify**: When a claim is completed, Sisu is set to the target sisu.
