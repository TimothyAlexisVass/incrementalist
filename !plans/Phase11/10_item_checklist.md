# Phase 11, Step 10: Item Checklist

## Objective
Port the Item Checklist daily task system to the server and Canvas UI.

## Implementation
- **Server Rules**: Reuse `checklist_rules.ex` with `checklist_key: "item"`.
  - Implement `check_off(state, "item")`: Consumes a token and grants the reward.
- **Client Render**: Add `item-checklist.ts` to `assets/src/features/bonustime/05-item-checklist/render.ts`.
  - Render a basic grid of 8 representational boxes (one for each item).
  - Use simple "Found" / "Missing" text labels or color changes.
- **Client Interaction**: `bonustime.play` updates the checklist state.
- **Reveal**: Highlight the newly found item box with a representational border.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text labels.

## Verification
- List displays 8 unique items correctly using basic shapes.
- Rewards are correctly mapped to the authoritative state.
