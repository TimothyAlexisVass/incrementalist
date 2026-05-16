# Phase 11, Step 14: Lucky Dice (7x7)

## Objective
Port the 7x7 Lucky Dice mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `lucky_dice.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `roll_dice(held_indexes)`: Generates seven 7-sided dice results, preserving held dice.
  - Implement `evaluate_combination(dice)`: Identifies the highest matching combination (Full House, Straights, etc.).
- **Client Render**: Add `lucky-dice.ts` to `assets/src/features/daily-bonus/render/`.
  - Render 3D-style or high-quality 2D animated dice.
  - Visual indicators for "Held" dice.
- **Client Interaction**: Toggle dice to hold/release and `Roll` button.
- **Reveal**: Display the detected combination and granted reward tier.

## Verification
- Dice combinations are correctly identified according to the rules table.
- Number of rerolls is correctly limited by streak.
