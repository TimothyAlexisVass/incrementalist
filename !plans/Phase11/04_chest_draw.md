# Phase 11, Step 4: Chest Draw & Command Orchestration [COMPLETED]

## Objective
Port the Chest Draw mini-game and establish the core `bonustime.play` command flow, ensuring server-authoritative rules and WebGL rendering.

## Implementation

### 1. Command & State Orchestration
- **Command**: Implement `bonustime.play { game: "chest_draw" }`.
  - **Token Logic**: Server checks for token availability.
    - Spend `daily_token` first.
    - If `daily_token` is 0, spend `special_token`.
    - If both are 0, return `token_empty` error.
  - **Deduplication**: Use `command_id` to prevent double-spending on a single intent.
- **State Merging**: 
  - Update `applyAuthoritativeData` in `assets/src/net/snapshots.ts` to merge the `bonustime` result slice.
  - Ensure `coins`, `exp`, `shards`, and `cores` are updated from the `reward` field in the result.

### 2. Server Rules (`chest_draw.ex`)
- **Location**: `lib/incrementalist/game/features/bonustime/games/chest_draw.ex`.
- **Logic**: Implement `roll_reward(streak)`.
  - Return a list of roll outcomes (length based on streak).
  - Return the final best outcome (highest tier).

### 3. Client Render (`chest-draw.ts`)
- **Location**: `assets/src/features/bonustime/01-chest-draw/render.ts`.
- **Render**:
  - Representational "Unknown chest" (colored box with text).
  - "Roll Track" (row of small boxes) below the chest.
- **Interaction**:
  - Clicking the chest box triggers the `bonustime.play` command.
- **Reveal sequence**:
  - Update box label to "Opening..." during the roll sequence.
  - Final state: Box label becomes "Revealed" and shows "Reward tier <tier>".
  - Highlight the winning roll on the track.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text. No 3D models or physics simulations.

## Verification
- Clicking the chest box spends a token and returns a valid reward.
- Roll track matches the rolls provided by the server.
- Authorized state (coins, etc.) updates correctly on the client after reveal.
