# Phase 11, Step 10: Item Checklist

## Objective
Port the Item Checklist (Shop/Sage items) daily task system to the server and Canvas UI.

## Implementation
- **Server Rules**: Reuse `checklist_rules.ex` with `checklist_key: "item"`.
  - Implement `check_off(state, "item")`: Consumes a token and grants the reward.
- **Client Render**: Render the item checklist grid using WebGL.
  - Highlight the "Next" item to be checked off.
- **Client Interaction**: Send `daily_bonus.play { game: "item_checklist" }` to "Check Off" the next item.
- **Reveal**: Play a checking animation on the specific item and show the reward.

## Verification
- Grid displays all 36 items correctly.
- Clicking "Check Off" advances the index and persists the change on the server.
- Reward is granted only once per day per goal.
