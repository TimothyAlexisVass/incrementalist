# Phase 12, Step 3: Lucky Dice

## Objective
Port the Lucky Dice mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `lucky_dice.ex` to `lib/incrementalist/game/features/bonustime/games/`.
  - Implement `roll_dice(streak)`: Returns the face values of two dice.
- **Client Render**: Add `lucky-dice.ts` to `assets/src/features/bonustime/lucky-dice/render.ts`.
  - Render representational boxes as "Dice".
  - Use text labels on the boxes (1-6) to show outcomes.
- **Client Interaction**: `Roll` button trigger.
- **Reveal**: Update box labels over a short duration to represent rolling, then settle on the final result.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text. No 3D models or physics simulations.

## Verification
- Roll results match server-authoritative data.
- Double rolls and other bonuses are correctly applied.
