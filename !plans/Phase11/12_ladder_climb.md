# Phase 11, Step 12: Ladder Climb

## Objective
Port the Ladder Climb mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `ladder_climb.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `climb_outcome(streak)`: Returns the highest rung reached before a "slip".
- **Client Render**: Add `ladder-climb.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a representational vertical "ladder" (stack of boxes).
  - Use a simple marker box to represent the player's current rung.
- **Client Interaction**: `Climb` button trigger.
- **Reveal**: Update the marker box position and rung label ("Rung 1", "Rung 2", etc.).

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text labels. No climbing animations.

## Verification
- Slip logic correctly matches server outcomes.
- Final rewards are applied correctly to the authoritative state.
