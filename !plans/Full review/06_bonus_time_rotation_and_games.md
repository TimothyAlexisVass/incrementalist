# Step 6: Bonus Time Rotation & Games Review Plan

This step governs entry tokens, streak persistence, time-based game rotation slots, rolling algorithms, state machines, and visual reveals.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Rotation Estimation (`getActiveGameId`)**: Estimates which game is active using `getServerNow()`, comparing it against the `rotation_anchor` timestamp (`assets/src/features/bonustime/view-model.ts`). Rotations shift every 12 hours (`SLOT_MS = 43_200_000`) across 9 possible slots.
- **View Switching**: Handles switching the viewport from `View.GAME` to `View.BONUSTIME`.
- **Chest Draw State Machine**:
  - `ChestState.IDLE`: Displays "CLICK TO REVEAL".
  - `ChestState.REVEALING`: When clicked, triggers `playBonusTime(channel, "chest_draw")` and cycles vibrant HSL colors while the request is in-flight.
  - `ChestState.REVEALED`: Transitions to this state once `performance.now() - revealStartTime > 1500` and the server's `lastTier` result is populated. Displays rarity color/label and "CLICK TO OPEN". Clicking again opens the Reward Modal.
- **Strict Hidden Outcomes Protection**: The client must **never** receive unpicked outcomes or guess outcome states beforehand. No speculative reveals are drawn.

### Server (Elixir)
- **Token Expenditures (`BonusTime.spend_token/1`)**: Consumes the player's single daily token (`has_bonustime_token`) first, and falls back to consuming premium `special_tokens` if needed.
- **Streak Evaluation (`BonusTime.advance_streak/2`)**: Advances play streaks by 1 for daily consecutive plays. If a calendar day is missed, it penalizes the streak by 3 per missed day (`missed_days * 3`), capping at 0.
- **Rolling Rewards (`ChestDraw.roll_reward/1`)**:
  - Streak Scale Bonus: Streak level scales the roll count (`1 + min(2, div(streak, 60))`).
  - Rolls are generated on the server using `:rand.uniform()`.
  - The server evaluates all rolls and **only retains the best tier** as the active outcome.
- **Outcome Serialization Gating**: Only reveals the picked tier and rolls in the response of the active command payload. Unpicked game outcomes are never written to the client state database or sent in broad snapshot structures.

---

## Step-by-Step Execution Verification Plan

### 1. Active Rotation Timing
- **Verify**: The next rotation timer counts down accurately.
- **Verify**: The rotation game aligns perfectly with server-side rules when 12-hour boundaries are crossed.

### 2. Token Consumption & Streak Auditing
- **Verify**: Play a round of Chest Draw with a daily token active.
- **Verify**: `has_bonustime_token` is set to `false`.
- **Verify**: Play a subsequent round of Chest Draw. Premium `special_tokens` are decremented.
- **Verify**: Test consecutive days and missed days in tests to confirm the streak scales and penalizes by `3` correctly.

### 3. Chest Draw State Machine & Color Cycles
- **Verify**: Clicking the Chest in Chest Draw transitions state to `REVEALING`.
- **Verify**: The chest spins smoothly through HSL gradients and shows "REVEALING...".
- **Verify**: The visual transition is locked to a minimum of 1.5 seconds (`elapsed > 1500` AND `lastTier !== null`) to ensure a smooth, premium reveal animation, avoiding instant visual jumps.
- **Verify**: In `REVEALED` state, clicking the chest correctly pops open the centered reward modal showing the earned rarity tier and coin sum.

### 4. Hidden Outcomes Integrity
- **Verify**: Memory-inspect the client snapshot and network traffic.
- **Verify**: No chest rolls, loot tables, or unpicked chest multipliers are ever sent to the client prior to executing the `playBonusTime` command.
- **Verify**: Code audit: No speculative local reveals exist. The server owns gameplay RNG completely.
