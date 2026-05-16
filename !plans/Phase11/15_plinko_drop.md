# Phase 11, Step 15: Plinko Drop

## Objective
Port the Plinko Drop mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `plinko_drop.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `generate_path(streak)`: Generates one or more paths through the 12-row peg board.
- **Client Render**: Add `plinko-drop.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a peg board with 13 reward cups at the bottom.
  - Animate the ball bouncing through the pins using the server-provided path.
- **Client Interaction**: `Drop` button starts the sequence.
- **Reveal**: Display the final cup landed and the highest reward across all drops.

## Verification
- Ball physics/bounces match the server-authoritative path exactly.
- Streak bonuses correctly grant extra drops.
