# Phase 11, Step 11: Reward Labyrinth

## Objective
Port the Reward Labyrinth mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `reward_labyrinth.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `generate_parameters(streak)`: Generates the labyrinth seed, item locations (5-10), and step budget (4-10 + streak bonus).
  - Implement `evaluate_results(found_items, path)`: Validates the movement path and items collected.
- **Client Render**: Add `reward-labyrinth.ts` to `assets/src/features/daily-bonus/render/`.
  - Implement a basic 2D grid or node-based view using simple lines/boxes.
  - Represent player movement as a box jumping between nodes.
- **Client Interaction**: Interactive movement choices via basic buttons or click targets.
- **Reveal**: Update box label to show reward tier found.

## Aesthetic Note
Implementations must be visually basic. Use representational shapes and text. Avoid complex tilesets or walking animations.

## Verification
- Labyrinth generation is deterministic from the server seed.
- Step budget is correctly enforced on both client and server.
- Rewards are correctly mapped to the authoritative state.
