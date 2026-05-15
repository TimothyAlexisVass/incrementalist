# Implementation Plan: Phase 9 & 10 - Quests and Achievements (Separated)

This plan breaks down the migration of Quests and Achievements into separate, sequential tracks to ensure focus and clarity for each feature.

## Overview

We will first implement the shared `ScrollingPanel` component, then proceed with the full implementation of Quests, followed by the full implementation of Achievements.

## Phase 9: Shared Infrastructure & Quests

### 1. [Phase 9.1: Scrolling Panel Component](9_1_scrolling_panel.md)
- **Goal**: Create a reusable Canvas component for scrollable content.
- **Deliverable**: `assets/src/ui/components/scrolling-panel.ts`.

### 2. [Phase 9.2: Quests Backend](9_2_quests_backend.md)
- **Goal**: Implement server-side logic for Quests.
- **Deliverable**: Definition loading, evaluation, and `quest.claim` commands.

### 3. [Phase 9.3: Quests UI](9_3_quests_ui.md)
- **Goal**: Build Quest cards and the main menu panel.
- **Deliverable**: `QuestCard` component and `Quests` tab in the main menu.

## Phase 10: Achievements

### 4. [Phase 10.1: Achievements Backend](10_1_achievements_backend.md)
- **Goal**: Implement server-side logic for Achievements.
- **Deliverable**: Definition loading, condition evaluation, and unlock logic.

### 5. [Phase 10.2: Achievements UI](10_2_achievements_ui.md)
- **Goal**: Build Achievement cards and the main menu panel.
- **Deliverable**: `AchievementCard` component and `Achievements` tab in the main menu.

## Final Integration

### 6. [Phase 10.3: Centralized Notice Integration](10_3_notices.md)
- **Goal**: Wire up both features to the centralized "green dot" system.
- **Deliverable**: Unified notification bubbling for Quests and Achievements.

## Implementation Order

1. **Scrolling Panel** (Infrastructure)
2. **Quests (Backend -> UI)** (First Feature)
3. **Achievements (Backend -> UI)** (Second Feature)
4. **Notices** (Cross-feature Wiring)
