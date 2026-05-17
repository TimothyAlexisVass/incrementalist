# Phase 11, Step 8: Coin Rain

## Objective
Port the Coin Rain interactive mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `coin_rain.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `generate_parameters(streak)`: Returns the game seed, duration, and multiplier.
  - Implement `evaluate_results(collected_count)`: Validates the player's performance against expected limits.
- **Client Render**: Add `coin-rain.ts` to `assets/src/features/daily-bonus/render/`.
  - Implement representational falling colored boxes (representing coins/gems).
  - Create a simple rectangle "catcher" at the bottom controlled by the player.
- **Client Interaction**: Start the game on `daily_bonus.play`. Send final count to the server upon completion.
- **Reveal**: Display the total collected amount and the applied multiplier from the server result.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and simple shapes. Focus on basic collision/collection logic rather than visual fidelity.

## Verification
- Interactive game runs correctly using representational shapes.
- Final rewards are applied correctly to the authoritative save state.
