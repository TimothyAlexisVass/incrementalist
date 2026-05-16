# Phase 11, Step 13: Hammer Smash

## Objective
Port the Hammer Smash mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `hammer_smash.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `evaluate_smash(timing, streak)`: Calculates smash power based on meter timing and streak floor.
  - Handle the "Smash the bell" extra attempt if two 100% smashes occur.
- **Client Render**: Add `hammer-smash.ts` to `assets/src/features/daily-bonus/render/`.
  - Implement a moving power meter and a vertical "high striker" pole.
  - Animate the hammer swing and the marker rising up the pole.
- **Client Interaction**: Single-click timing to stop the meter.
- **Reveal**: Reveal the final reward tier based on pole height, plus any extra bell-break rewards.

## Verification
- Meter timing is client-side for responsiveness but validated by the server.
- Bell-break logic correctly grants additional rewards.
