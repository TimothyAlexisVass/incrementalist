# Phase 11, Step 7: Prize Wheel

## Objective
Port the Prize Wheel mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `prize_wheel.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `spin_outcome(streak)`: Returns the winning slot index and reward values.
- **Client Render**: Add `prize-wheel.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a circular wheel with segments and a pointer.
  - Implement a smooth rotation animation logic that can stop at a specific angle.
- **Client Interaction**: Send `daily_bonus.play { game: "prize_wheel" }` on "Spin" click.
- **Reveal**: Synchronize the rotation duration so the wheel stops on the server-calculated result segment.

## Verification
- Wheel spins smoothly and stops on the correct segment.
- Reward popup matches the server's authoritative data.
