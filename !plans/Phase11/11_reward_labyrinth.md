# Phase 11, Step 11: Reward Labyrinth

## Objective
Port the Reward Labyrinth mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `reward_labyrinth.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `generate_parameters(streak)`: Generates the labyrinth seed, item locations (5-10), and step budget (4-10 + streak bonus).
  - Implement `evaluate_results(found_items, path)`: Validates the movement path and items collected.
- **Client Render**: Add `reward-labyrinth.ts` to `assets/src/features/daily-bonus/render/`.
  - Implement a 2D grid or node-based labyrinth view.
  - Animate player movement between junctions.
- **Client Interaction**: Interactive movement choices (Forward, Left, Right, Back).
- **Reveal**: Reveal the best reward tier found among collected items or the consolation tier.

## Verification
- Labyrinth generation is deterministic from the server seed.
- Step budget is correctly enforced on both client and server.
- Rewards are correctly mapped to the authoritative state.
