# Phase 9.3: Quests UI

## Goal
Build the Quest card components and the main menu panel.

## Tasks

### 1. Real Quest Card
- Replace the placeholder in `assets/src/ui/components/cards/quest.ts` with the real implementation.
- **Visuals**:
  - Quest name.
  - Current rank display (e.g., "Rank 2/4").
  - Progress bar showing current rank progress.
  - "CLAIM" button (active only when a rank is completed but not yet claimed).
  - Reward preview for the next rank.

### 2. Quests Panel Implementation
- Update `assets/src/ui/layout/main-menu/panels/quests/`:
  - `view-model.ts`: Derives a list of quest data from the server snapshot.
  - `render.ts`: Replace placeholders with real Quest cards mapped from the view-model.
  - `interactions.ts`: Handles card button clicks and passes them to the command system.

### 3. Main Menu Integration
- Update `assets/src/ui/layout/main-menu/view-model.ts`:
  - Replace the "Quest" placeholder with the real panel renderer.

## Deliverable
Functional Quests tab in the main menu showing a scrollable list of quest cards.
