# Phase 12, Step 7: Hammer Smash

## Objective
Port the Hammer Smash mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `hammer_smash.ex` to `lib/incrementalist/game/features/bonustime/games/`.
  - Implement `evaluate_smash(timing, streak)`: Calculates smash power based on meter timing and streak floor.
  - Handle the "Smash the bell" extra attempt if two 100% smashes occur.
- **Client Render**: Add `hammer-smash.ts` to `assets/src/features/bonustime/hammer-smash/render.ts`.
  - Implement a basic moving power meter (sliding box) and a vertical "high striker" pole (thin rectangle).
  - Use a text label to represent the "Smash!" action.
- **Client Interaction**: Single-click timing to stop the meter.
- **Reveal**: Move a marker box up the pole based on power; update label to "Result: Tier X".

## Aesthetic Note
Implementations must be visually basic. Use representational shapes and text. No hammer sprites or swing animations.

## Verification
- Meter timing is client-side for responsiveness but validated by the server.
- Bell-break logic correctly grants additional rewards.
