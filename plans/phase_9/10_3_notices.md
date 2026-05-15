# Phase 10.3: Centralized Notice Integration

## Goal
Wire up both Quests and Achievements into the centralized "green dot" notification system.

## Tasks

### 1. Server-Side Registry
- Register all quest and achievement leaf IDs and their parent tab IDs in the server-owned notice registry.
- Define parent chains (Leaf -> Tab -> Main Menu).

### 2. Bubbling Logic
- Ensure the server-side notice evaluator correctly bubbles up notices from individual quests/achievements to their respective tabs and the main menu button.

### 3. Client Integration
- Update cards to render notice dots based on server-provided `active_leaf_ids`.
- Emit notice events (`child_clicked`, `child_shown`) to sync with the server.

## Deliverable
Notification dots appear and clear correctly for both Quests and Achievements, bubbling up to the main menu.
