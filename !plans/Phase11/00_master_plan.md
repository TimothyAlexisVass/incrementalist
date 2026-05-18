# Phase 11: Daily Bonus Master Plan (BONUSTIME)

## Core Mechanics

- **Tokens**: Two types of bonus tokens:
  - `daily`: Rotating tokens (non-persistent, capped).
  - `special`: Persistent tokens (from special events/quests).
- **Spending**: `daily` tokens are prioritized over `special` tokens.
- **Grant Rule**: 1 `daily` token is granted at each 12-hour boundary **ONLY IF** the player currently has `0 daily tokens`.

## Rotation Logic

- **Frequency**: Active game changes every 12 hours (`00:00 UTC` and `12:00 UTC`).
- **Rotation Length**: 15 games (full rotation takes 7.5 days).
- **Drift**: Because the 15-slot rotation (180 hours) is not a multiple of 24 hours, games drift between morning (00:00-12:00) and evening (12:00-24:00) slots every 7.5 days.
- **Anchor Calculation**:
  - `rotationAnchorUtc`: `00:00 UTC` boundary where slot 1 starts.
  - `boundaryIndex`: `floor((now - anchor) / 12 hours)`.
  - `activeSlot`: `(boundaryIndex % 15) + 1`.
  - `nextChangeAt`: `anchor + ((boundaryIndex + 1) * 12 hours)`.

## Streak System

- **Advancement**: +1 streak per day if at least one game is played.
- **Limit**: Max +1 streak per day.
- **Decay**: If a day is missed, streak is reduced by 3 (minimum 0).
- **Scaling**: Each non-checklist game uses `streak` differently (more attempts, better floors, extra reveal chances).

## Game Design Principles

- **Full Screen UI**: Each game takes up the entire DISPLAY_AREA space.
- **Quick Resolution**: Games should be fast to play.
- **Interaction**: Every token spend results in an outcome.
- **No Losing**: Every game must result in at least one reward (Tiers 1-7).
- **Visual Aesthetic**: Initial implementations are **visually basic and representational** (colored boxes/text) to claim layout space before final polish.

## Implementation Steps

1.  **Server Foundation**: Logic for rotation, tokens, and streak.
2.  **Tab Layout**: Daily tab integration in Canvas/WebGL.
3.  **Command Orchestration**: Protocol and state merging.
4.  **One-Shot Mini-Games**: Step-by-step porting of the 10 one-shot rotation games.
5.  **Complex Mini-Games**: Step-by-step porting of the 5 multi-step rotation games, with Card Pick and Match Pairs tracked in later Phase 12 docs.

The full daily-bonus rotation is 15 games total. Card Pick and Match Pairs are separate later mini-games, not part of that 15-slot rotation.
