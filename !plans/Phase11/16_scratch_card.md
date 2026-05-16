# Phase 11, Step 16: Scratch Card

## Objective
Port the Scratch Card mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `scratch_card.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `generate_grid(streak)`: Generates a grid of hidden symbols.
- **Client Render**: Add `scratch-card.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a grid of "Hidden" boxes (colored rectangles).
  - On click, immediately change box color/label to show the hidden symbol.
- **Client Interaction**: Click-to-reveal on individual slots.
- **Reveal**: Change revealed box labels to show reward tier or "Miss".

## Aesthetic Note
Implementations must be visually basic. Use representational colored boxes. No actual "scratching" texture effects.

## Verification
- Grid symbols match server-provided data.
- Matching logic correctly triggers reward grants.
