# Phase 11, Step 18: Bonus Time (Board Flip)

## Objective
Port the Bonus Time board-flip mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `bonus_time.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `generate_board()`: Creates a 16x8 grid with one guaranteed Tier 7 and 127 randomized rewards.
  - Track flipped tiles and remaining flip budget (based on streak and weekly activity).
- **Client Render**: Add `bonus-time.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a grid of 128 face-down tiles.
  - Animate tile flips to reveal the hidden reward.
- **Client Interaction**: Clicking individual tiles to flip them.
- **Reveal**: Each flip reveals its reward immediately; final total shown at end of flips.

## Verification
- Board contains exactly one Tier 7 tile.
- Flip budget is correctly calculated from recent activity and streak.
