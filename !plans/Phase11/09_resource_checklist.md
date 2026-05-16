# Phase 11, Step 9: Resource Checklist

## Objective
Port the Resource Checklist daily task system to the server and Canvas UI.

## Implementation
- **Server Rules**: Add `checklist_rules.ex` to `lib/incrementalist/game/features/daily_bonus/`.
  - Implement `check_off(state, checklist_key)`: Consumes a token and grants the reward at `checklist_entry_indexes[checklist_key]`.
  - Increment the entry index (modulo 36).
- **Client Render**: Render the 36-item checklist grid using WebGL.
  - Highlight the "Next" item to be checked off.
- **Client Interaction**: Send `daily_bonus.play { game: "resource_checklist" }` to "Check Off" the next item.
- **Reveal**: Play a checking animation on the specific item and show the reward.

## Verification
- Grid displays all 36 items correctly.
- Clicking "Check Off" advances the index and persists the change on the server.
