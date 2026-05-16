# Phase 11, Step 6: Chest Draw

## Objective
Port the Chest Draw mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `chest_draw.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `roll_reward(streak)`: Returns a list of rolls (length based on streak) and the final best outcome.
- **Client Render**: Add `chest-draw.ts` to `assets/src/features/daily-bonus/render/`.
  - Render **one** main chest using WebGL.
  - Implement a "Roll Track" (row of circles) below the chest to show multiple roll outcomes.
- **Client Interaction**: Send `daily_bonus.play { game: "chest_draw" }` when the "Open Chest" button is clicked.
- **Reveal**:
  - Lid lifts slightly as each roll on the track is revealed.
  - Show the final reward in the chest and highlight the best roll on the track.

## Verification
- Chest lid animates during reveals.
- Roll track correctly displays multiple outcomes based on streak.
- Best outcome matches the server result.
