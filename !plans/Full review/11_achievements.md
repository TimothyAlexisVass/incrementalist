# Step 11: Achievements Review Plan

This step governs achievement unlocks, criteria matching, multiplier calculations, progress bar claim link integrations, and shown notice synchronization.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Achievements Panel (`renderAchievementsTab`)**: Rendered inside `assets/src/ui/layout/main-menu/panels/achievements/render.ts`.
- **Card Drawing (`drawAchievementCard`)**:
  - Locked achievements display dark backgrounds (`#0a0a0a`), grey texts, and grey locked multipliers.
  - Unlocked achievements display normal panel backgrounds, cleanOutfit titles, gold multiplier labels, and unlock dates.
  - New unlocks present flashing green notice markers.
- **Shown Logs**: Automatically calls `markViewed(channel, 'achievements')` when opening the tab to sync seen indicators to the server.

### Server (Elixir)
- **Active Achievement Evaluation (`Achievements.Rules.evaluate/1`)**:
  - Runs on every save or update, evaluating unlocked conditions: tutorials, level bounds, lifetimes coins/shards/cores earned, total claims completed, and tabs viewed.
  - Unlocks achievements immediately using the current server timestamp in UTC.
- **Progress Bar Linkage**:
  - Accumulates unlocked multipliers: `reward_multiplier = 1.0 + total_multiplier`.
  - Re-assigns the effective multiplier directly over `state.progress_bar.reward_multiplier`.
  - Proves a **direct feedback loop**: completing achievements directly increases the progress bar's coin claim payouts.

---

## Step-by-Step Execution Verification Plan

### 1. Locked vs Unlocked Achievement Cards
- **Verify**: Open the Achievements Tab.
- **Verify**: Locked achievements are visually greyed out and display their requirements clearly (e.g. `"Reach Level 40"`).
- **Verify**: Unlocked achievements draw with premium colors, clear gold multipliers, and the exact unlock date.

### 2. Condition Unlock Verification
- **Verify**: Cross a milestone (e.g., earn 50,000 lifetime coins).
- **Verify**: Open the achievements panel.
- **Verify**: The achievement unlocks instantly, writing the active timestamp to the persistent player state.
- **Verify**: A stacked `Achievement Unlocked!` floating toast alert pops up on screen.

### 3. Progress Bar Claim Linkage
- **Verify**: Examine the progress bar's baseline reward calculation.
- **Verify**: Unlock a new +15% achievement.
- **Verify**: The progress bar's effective claim payouts (both visual projections and authoritative server rewards) must increase by exactly 15% in the next claim.

### 4. Notice Mark Clearing
- **Verify**: A newly unlocked achievement displays a green dot marker in the card's top right corner.
- **Verify**: Opening the tab dispatches `notice.event` with the child leaf kind `child_shown`.
- **Verify**: The green dot clears, ensuring that players are not bugged by persistent unread marks once they have seen the achievements.
