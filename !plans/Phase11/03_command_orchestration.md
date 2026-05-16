# Phase 11, Step 3: Command Orchestration

## Objective
Finalize the network protocol and state synchronization for the Daily Bonus system.

## Implementation
- **Commands**: Implement final logic for `daily_bonus.open` (to check for day rollovers) and `daily_bonus.play`.
- **State Merging**: Ensure `applyAuthoritativeData` in `snapshots.ts` correctly handles the `daily_bonus` payload.
- **Error Handling**: Implement machine-readable error reasons for "token_empty", "game_not_available", or "streak_invalid".
- **Cleanup**: Remove any temporary debug buttons or logging once the flow is verified.

## Verification
- End-to-end flow from login -> Daily tab -> Play game -> Reward claim -> State persist works without sync issues.
- Command deduplication prevents multiple claims for the same token.
