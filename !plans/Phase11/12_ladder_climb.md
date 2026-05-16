# Phase 11, Step 12: Ladder Climb

## Objective
Port the Ladder Climb mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `ladder_climb.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `evaluate_climb(current_step, streak)`: Determines success/failure for a climb attempt based on base chances and streak bonus.
- **Client Render**: Add `ladder-climb.ts` to `assets/src/features/daily-bonus/render/`.
  - Display a 20-rung ladder with visual markers for current progress.
  - Animate successful climbs and "slip" failures.
- **Client Interaction**: `Climb` button sends command to server; server returns result of that specific step.
- **Reveal**: Display the final rung reached and the corresponding reward.

## Verification
- Climb chances correctly incorporate the streak bonus.
- Ladder state persists across reconnects if the game is unfinished.
