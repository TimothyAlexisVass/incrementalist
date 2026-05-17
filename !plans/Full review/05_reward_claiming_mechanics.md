# Step 5: Reward Claiming Mechanics Review Plan

This step governs player interaction testing, collection events, automatic idle mode claiming, and the client-side asynchronous wait-retry loop for server synchronization.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Input Capturing & Hit Testing**: Captures pointer clicks inside `assets/src/ui/managers/interactions.ts`. Clicks are checked against:
  - Menu panels and modals (which take input precedence).
  - BottomHUD buttons, shop buttons, Sisu triggers.
- **Activity Collection (`claimRewardOnAnyInput`)**: If the bar is in `confirmed_collectible` state, *any* screen activity (click/keypress) that is not swallowed by other UI targets triggers the claim.
- **Visual Popup Anchoring**: Captures the exact coordinate (`clickPoint`) where the screen was clicked and passes it to `spawnProgressClaimRewardEffects`. The currency floaters spring out directly from the click anchor.
- **Idle Mode Auto-Collection (`claimRewardInIdleMode`)**: If idle mode is active and the bar is ready, the client automatically triggers the claim, centering the reward popup directly over the middle of the progress bar.
- **Asynchronous Wait-Retry Loop (`resolveClaimAsync`)**:
  - Once a claim is initiated, the state transitions to `awaiting_server_confirmation` and sets `pendingClaimIntent = true`, keeping the visual bar at `0%`.
  - In `resolveClaimAsync`, if the server responds with a `claim_not_ready` error, the loop **does not exit**. It reads the server's suggested delay `can_claim_in`, sleeps using a Promise-based `setTimeout`, and retries `progressClaimReward` until a non-error result arrives.
- **Centralized State Synchronization**: Upon success, `applyProgressResult(result)` merges currency increments and increments levels using `applyAuthoritativeData`.

### Server (Elixir)
- **Wait Verification (`execute("progress.claim_reward")`)**: Reloads player state. If `can_claim_in > 0`, it rejects the request with a `claim_not_ready` error carrying the exact remaining milliseconds.
- **Reward Computation (`Bar.claim_reward/2`)**: Computes `exp_gain`, `coin_gain`, `shard_gain`, and `core_gain` using high-precision `BigNum` math.
- **Level Scaling Validation**: Grants level-up bonuses automatically if the player crosses progression thresholds, returning updated balances in the command result.

---

## Step-by-Step Execution Verification Plan

### 1. Click Non-Swallowing Rule Verification
- **Verify**: Open the Main Menu/Shop. Click a shop button.
- **Verify**: The click executes the shop purchase and **never** triggers progress bar collection simultaneously (shop interaction takes visual/input priority).
- **Verify**: When the progress bar is ready and no overlay is open, clicking anywhere on the screen successfully triggers collection.
- **Verify**: The flying popup text rises directly from the exact mouse coordinates clicked.

### 2. Idle Mode Auto-Claim Verification
- **Verify**: Purchase Idle Mode from the shop. Toggle it on.
- **Verify**: Let the progress bar fill up.
- **Verify**: Once visual fill reaches 100% (after the early visual buffer), the client automatically claims the reward.
- **Verify**: The floating popups are centered perfectly over the middle of the progress bar layout:
  `{ x: layout.x + layout.width / 2, y: layout.y + layout.height / 2 }`.

### 3. Asynchronous Wait-Retry Loop Resiliency
- **Verify**: Artificially introduce a 200ms network delay or clock mismatch where the client thinks the bar is full but the server disagrees by a fraction of a second.
- **Verify**: When the client claims, the server returns `claim_not_ready` with a small `can_claim_in` value.
- **Verify**: Inspect console network logs. The client's `resolveClaimAsync` must **keep waiting and retrying** after the specified sleep interval.
- **Verify**: The visual progress bar must **remain locked at 0%** throughout the retrying state, preventing "bounce" glitches.
- **Verify**: The loop succeeds eventually once the server time catches up, and the visual floater effects spawn.

### 4. High-Precision Reward Merging
- **Verify**: Claims correctly add to coins, shards, cores, and exp.
- **Verify**: Levelling up triggers the stacked `Level Up!` GPU notification animations correctly.
