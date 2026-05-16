# Phase 11, Step 6: Chest Draw

## Objective
Port the Chest Draw mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `chest_draw.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `roll_reward(streak)`: Returns a list of rolls (length based on streak) and the final best outcome.
- **Styling**: Ensure the Daily tab uses consistent theme colors from `assets/src/theme/colors.ts`.
- **Aesthetic Constraint**: UI must be representational and visually basic. Use simple shapes (rectangles/circles) and text labels rather than detailed sprites or animations.
- **Client Render**: Add `chest-draw.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a representational "Unknown chest" (colored box with text).
  - Implement a "Roll Track" (row of small boxes) below the chest.
- **Client Interaction**: Send `daily_bonus.play { game: "chest_draw" }` when the "Open Chest" button is clicked.
- **Reveal**:
  - Update the main box label to "Opening chest" during the roll sequence.
  - Final state: Change box label to "Revealed chest" and show a secondary box below with "Reward tier <tier>".
  - Highlight the winning roll on the track with a border or color change.

## Aesthetic Note
Implementations must be visually basic. Do not use opening lids or complex animations. Use representational colored boxes to claim layout space.

- **Verification**:
  - Box labels update correctly during the play sequence.
  - Roll track correctly displays representational outcomes.
  - Best outcome matches the server result.
