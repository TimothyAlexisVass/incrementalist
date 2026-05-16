# Phase 11, Step 16: Scratch Card

## Objective
Port the Huge Scratch Card mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `scratch_card.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `generate_layout(streak)`: Places 10 hidden items and calculates pixel budget.
  - Implement `claim_item(item_id, revealed_percentage)`: Validates if an item was sufficiently revealed to be claimed.
- **Client Render**: Add `scratch-card.ts` to `assets/src/features/daily-bonus/render/`.
  - Use a dynamic texture or mask to handle the scratching effect in WebGL.
  - Render the hidden items as they are uncovered.
- **Client Interaction**: Dragging the "scratcher" across the card surface.
- **Reveal**: Instant reveal of items as they meet the threshold; final reward summary at the end.

## Verification
- Pixel budget is correctly depleted by scratching and lifting the scratcher.
- Multi-touch or fast scratching is handled without desync.
