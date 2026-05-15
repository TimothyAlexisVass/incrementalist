# Phase 9.1: UI Skeleton & Scrolling Panel

## Goal
Create a reusable Canvas component for scrollable content and implement UI skeletons for Quests and Achievements to verify scrolling with placeholder data.

## Tasks

### 1. Placeholder Cards
- Create `assets/src/ui/components/cards/quest.ts` (Placeholder).
- Create `assets/src/ui/components/cards/achievement.ts` (Placeholder).
- These should render a simple rect with a label and index.

### 2. Scrolling Panel Component
- Create `assets/src/ui/components/scrolling-panel.ts`.
- Implement clipping (scissors), scroll offsets, and basic drag-to-scroll interaction.
- Add a scroll bar visual.

### 3. UI Skeleton Integration
- Create `assets/src/ui/layout/main-menu/panels/quests/render.ts`:
  - Implement a internal TabMenu for "Daily" and "Main" sub-tabs.
  - Fill each tab with 20+ placeholder Quest cards to ensure overflow.
- Create `assets/src/ui/layout/main-menu/panels/achievements/render.ts`:
  - Fill with 20+ placeholder Achievement cards to ensure overflow.

### 4. Main Menu Integration
- Update `assets/src/ui/layout/main-menu/view-model.ts` to render these new panel skeletons.

## Deliverable
Functional scrolling panels in both Quest and Achievement tabs, populated with enough placeholder content to demonstrate scrolling.
