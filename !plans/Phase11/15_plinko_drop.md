# Phase 11, Step 15: Plinko Drop

## Objective
Port the Plinko Drop mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `plinko_drop.ex` to `lib/incrementalist/game/features/bonustime/games/`.
  - Implement `generate_path(streak)`: Generates one or more paths through the 12-row peg board.
- **Client Render**: Add `plinko-drop.ts` to `assets/src/features/bonustime/plinko-drop/render.ts`.
  - Render a basic peg board (grid of points) and reward boxes at the bottom.
  - Move a small circle (ball) between peg positions based on the server path.
- **Client Interaction**: `Drop` button starts the sequence.
- **Reveal**: Update the landed box label to show reward tier.

## Aesthetic Note
Implementations must be visually basic. Use representational points and circles. No complex physics or collisions.

## Verification
- Ball path matches the server-authoritative path exactly.
- Streak bonuses correctly grant extra drops.
