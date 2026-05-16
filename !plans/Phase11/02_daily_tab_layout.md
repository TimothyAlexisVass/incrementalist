# Phase 11, Step 2: Daily Tab Layout (BONUSTIME)

## Objective
Integrate the Daily Bonus entrance into the main Canvas-based application layout, mirroring the legacy "BONUSTIME" center-stage HUD presence.

## Implementation
- **BONUSTIME Button**: Create `assets/src/ui/components/bonustime-button.ts`.
  - Implement a `doBonusTimeButton` function (following the `doButton` pattern).
  - Implement the **rainbow-colored hue-rotation animation** for the text when `daily_tokens > 0`.
  - Render the text in a muted grey when `daily_tokens === 0`.
- **HUD Integration**:
  - Use `doBonusTimeButton` in the center of the HUD.
  - Clicking this area toggles `currentView` between `GAME` and `BONUSTIME`.
  - **Locked State**: If `features.bonus_time_purchased` is false, show the button as locked using `drawLockedElement`.
  - **Tooltips**: Hovering the button shows `Daily Tokens`, `Special Tokens`, and `Streak`.
- **View Transition**:
  - `BONUSTIME` view renders within the `DISPLAY_AREA` (replacing Area Specifics) but **does not pause the game loop**.
  - The progress bar and Top/Bottom HUD remain visible and interactive.
- **Initial State**: Players start with `has_daily_token: true` by default.
- **Overview Rendering**:
  - `renderBonusTimeOverview` in `assets/src/features/bonustime/render.ts`.
  - Occupies the entire `DISPLAY_AREA`.
  - Displays a subtle active game indicator and maximizes space for mini-game content.
  - **Aesthetic Constraint**: UI should be visually basic (simple boxes/text) to define layout space.
- **State Integration**: Ensure `daily_tokens` and `streak` from the server snapshot are accessible to the renderer.

## Verification
- "BONUSTIME" button is center-stage in the bottom HUD.
- Rainbow animation triggers correctly based on token availability.
- Clicking transitions to the `BONUSTIME` view.
- Overview displays authoritative server state correctly.
