# Phase 10.2: Achievements UI

## Goal
Build the Achievement card components and the main menu panel.

## Tasks

### 1. Real Achievement Card
- Replace the placeholder in `assets/src/ui/components/cards/achievement.ts` with the real implementation.
- **Visuals**:
  - Achievement name.
  - Condition text (derived or hardcoded based on `condition`).
  - Star reward display.
  - Locked vs. Unlocked visual states (e.g., dimmed/grayscale for locked).

### 2. Achievements Panel Implementation
- Update `assets/src/ui/layout/main-menu/panels/achievements/`:
  - `view-model.ts`: Derives achievement data (sorted by unlocked state).
  - `render.ts`: Replace placeholders with real Achievement cards mapped from the view-model.
  - `interactions.ts`: Handle hover/tooltips if needed.

### 3. Main Menu Integration
- Update `assets/src/ui/layout/main-menu/view-model.ts`:
  - Replace the "Achievements" placeholder with the real panel renderer.

## Deliverable
Functional Achievements tab in the main menu showing a scrollable list of achievement cards.
