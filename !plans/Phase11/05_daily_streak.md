# Phase 11, Step 5: Daily Streak

## Objective
Implement the visual and logic representation of the login streak system.

## Implementation
- **Logic**: In requirement-based rules, use `streak` to scale game-specific parameters:
  - **Chest Draw**: Scale roll count (1-3) based on `streak / 60`.
  - **Prize Wheel**: Scale spin count (1-3) based on `streak / 30`.
  - **Card Pick**: Scale initial pick count (2-9) based on `streak / 7`.
  - **Coin Rain**: Scale timer, bucket width, and speed based on `streak`.
- **Client Render**: Display the current streak number and last played timestamp in the Daily panel.
- **Integration**: Ensure the `streak` (formerly `attendance`) quest is updated whenever the streak is advanced.

## Verification
- Streak correctly influences game-specific "roll" or "pick" counts.
- Quest progress is reflected in the Quests panel.
