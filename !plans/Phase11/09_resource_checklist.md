# Phase 11, Step 9: Resource Checklist

## Objective
Port the Resource Checklist daily task system to the server and Canvas UI.

## Implementation
- **Server Rules**: Add `checklist_rules.ex` to `lib/incrementalist/game/features/daily_bonus/`.
  - Implement `check_off(state, checklist_key)`: Consumes a token and grants the reward at `checklist_entry_indexes[checklist_key]`.
  - Increment the entry index (modulo 36).
- **Client Render**: Add `resource-checklist.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a basic grid of representational boxes (e.g., 6x6 or scrollable list).
  - Use simple "Collected" / "Locked" text labels or color changes.
- **Client Interaction**: `daily_bonus.play` command updates the authoritative index.
- **Reveal**: Highlight the newly checked box with a representational border or color change.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text labels. No complex icons or particle effects.

## Verification
- Grid displays all 36 items correctly using basic shapes.
- Clicking "Check Off" advances the index and persists the change on the server.
