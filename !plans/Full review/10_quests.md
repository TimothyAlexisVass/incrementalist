# Step 10: Quests Review Plan

This step governs quest ranks, criteria progression evaluations, client-side scrolling list cards, click hit tests, and reward claiming processes.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Quests Panel Display (`renderQuestsTab`)**: Rendered inside `assets/src/ui/layout/main-menu/panels/quests/render.ts` as a horizontal dual-tab view:
  - **Main**: Lifetime quests.
  - **Daily**: Regularly rotating objectives.
- **Scrolling list Panels**: Uses `ScrollingPanel` to scroll through arrays of quest cards, providing swipe offsets (`scrollOffsetY`) and scrollbars.
- **Quest Card Visuals (`drawQuestCard`)**:
  - Displays quest name, rank progression indicator (e.g. `Rank 1/5`), and horizontal progress bar.
  - Completed but unclaimed quests display a green border and a flashing green notice marker over the **CLAIM** button.
- **Claim Interactions**: Clicking a completed card's **CLAIM** button triggers `questClaim(channel, questId)` (`assets/src/net/commands.ts`).
- **Shown Logs**: On rendering the quests tab, it calls `markViewed(channel, 'quests')` to sync seen indicators to the server.

### Server (Elixir)
- **Active Quest Sourcing (`Quests.Rules.evaluate/1`)**:
  - Evaluates quest conditions on save or update: level ups, achievements unlocked, lifetime coins/shards/cores earned, total claims completed, daily streaks.
  - Multi-Rank Completion: If progress is high, `check_further_ranks` iterates subsequent quest ranks, capping active progress targets.
- **Claim Logic (`Quests.Rules.claim/2`)**:
  - Checks that the target rank hasn't been claimed yet.
  - Awards coins calculated through the rank def, applying `BigNum` math.
  - Increments claimed rank indices and lifetime claim statistics.
  - **Re-evaluation Dependency**: Runs `evaluate(new_state)` immediately after a claim, as claiming a quest may satisfy other downstream quests (e.g. `quest_c_rank`).

---

## Step-by-Step Execution Verification Plan

### 1. Tab Menu Scrolling & Layouts
- **Verify**: Open the main menu, select the Quests tab.
- **Verify**: Main and Daily sub-tabs switch smoothly without throwing errors.
- **Verify**: Dragging or scrolling using a scroll wheel rolls the scrolling panels with clean bounding clip rectangles.

### 2. Multi-Rank Evaluation Check
- **Verify**: Complete a quest multiple times over (e.g., gain 50 levels before claiming a level-up quest rank).
- **Verify**: The server evaluates further ranks and sets the active claim rank to the furthest completed rank.
- **Verify**: Claiming the reward increments `claimed_rank` directly to the completed tier, granting accumulated coins.

### 3. Click Claim Hit Testing
- **Verify**: Click the **CLAIM** button inside a completed quest card.
- **Verify**: The click hit-test registers properly, triggering a `quests.claim` command.
- **Verify**: The coins balance increments immediately on the top HUD.
- **Verify**: The green dot notice fades away from both the card and the quests tab.

### 4. Downstream Re-evaluation Verification
- **Verify**: Complete a quest rank. That rank's claim satisfies a downstream "claim X quest ranks" requirement.
- **Verify**: Claiming the first quest must **instantly** unlock the claim status of the dependent quest in the same tick (guaranteed by Elixir's re-evaluate call).
