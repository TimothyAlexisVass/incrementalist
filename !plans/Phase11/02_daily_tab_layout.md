# Phase 11, Step 2: Daily Tab Layout

## Objective
Integrate the Daily Bonus UI into the main Canvas-based application layout.

## Implementation
- **Navigation**: Update `assets/src/render/layout/tabs.ts` (or equivalent) to include a "Daily" tab icon and label.
- **Rendering**: Create `assets/src/features/daily-bonus/render.ts`.
  - Implement a main container for the Daily tab.
  - Render the current game title, tokens remaining, and streak counter.
- **Interactions**: Update `assets/src/core/input.ts` or `interactions.ts` to handle tab switching to the Daily view.
- **Styling**: Ensure the Daily tab uses consistent theme colors from `assets/src/theme/colors.ts`.
- **Aesthetic Constraint**: UI must be representational and visually basic. Use simple shapes (rectangles/circles) and text labels rather than detailed sprites or animations.

## Verification
- Tab is clickable and displays the Daily view area.
- Current tokens and streak from the server snapshot are displayed correctly using basic text/boxes.
