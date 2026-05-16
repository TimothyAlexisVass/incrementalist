# Phase 11, Step 7: Prize Wheel

## Objective
Port the Prize Wheel mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `prize_wheel.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `spin_outcome(streak)`: Returns the winning slot index and reward values.
- **Client Render**: Add `prize-wheel.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a representational circle or box as the "Wheel Area".
  - Use simple text labels ("Spinning...", "Result") to show state.
- **Client Interaction**: Send `daily_bonus.play { game: "prize_wheel" }` on "Spin" click.
- **Reveal**: Immediately transition to the result state or use a simple timer-based label swap to represent the spin.

## Aesthetic Note
Implementations must be visually basic. Use representational shapes and text labels. No complex animations or high-fidelity sprites.

- **Verification**:
  - Labels update correctly from "Idle" to "Spinning" to "Result".
  - Result matches server authoritative data.
