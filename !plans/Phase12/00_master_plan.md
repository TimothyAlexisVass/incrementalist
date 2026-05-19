# Phase 12: Daily Bonus Master Plan (BONUSTIME - Part 2)

## Overview

This phase covers the implementation and WebGL representation of the remaining seven daily-bonus (`BONUSTIME`) mini-games:
- **Reward Labyrinth** (Slot 7)
- **Ladder Climb** (Slot 8)
- **Card Pick** (Slot 9) — A one-shot card-flipping game with local reveals.
- **Lucky Dice** (Slot 10) — A Yatzy-style 7x7 dice roller.
- **Scratch Card** (Slot 12) — An interactive scrubbing game with a brush size and pixel budget.
- **Match Pairs** (Slot 13) — A tile-matching memory game with a mistake budget.
- **Hammer Smash** (Slot 6) — A carnival-style striker timing game.

---

## Core Game Rotation & Schedules

All games are evaluated and served within the 12-hour rotation boundaries (`00:00 UTC` and `12:00 UTC`). The active slot is determined dynamically based on the server-owned time and anchors.

| Slot | Game Name | Type | Interaction Model |
| :---: | --- | --- | --- |
| **6** | Hammer Smash | Volatility Choice | Interactive timing bar + multiple clicks + extra smash |
| **7** | Reward Labyrinth | Hidden Choice | Node-based maze pathfinding exploration |
| **8** | Ladder Climb | Upgrade Choice | Upward progression push with risk of slipping |
| **9** | Card Pick | Hidden Choice | One-shot grid precalculations and clicks (like `its_bonus_time`) |
| **10** | Lucky Dice | Pure Chance | 7x7 dice rolls, customizable keeps and rerolls |
| **12** | Scratch Card | Hidden Choice | Scrubbing/scratching mask area, releasing penalty |
| **13** | Match Pairs | Light Skill | Memory matching 48 tiles (24 pairs), mistake limits |

---

## Core Rules & Architecture Constraints

1. **The Server Owns Truth**: The client never makes assumptions about the outcomes of card flips, labyrinth paths, dice rolls, or hammer power. The client captures user input as *intent* (selected indexes, movement buttons, roll triggers, click timing) and submits them via standard command protocols.
2. **Interactive Sessions vs One-Shot**: 
   - Stateful games (Labyrinth, Ladder, Dice, Scratch, Pairs, Hammer) operate via a Server-Side Session state stored in `player_states.jsonb` (e.g., `match_pairs_session`).
   - One-shot games (Card Pick) use a single token spend command to roll the entire outcome (total picks, board multipliers) on the server, relying on local client interactions for the flipping and visual reveal phases.
3. **Streak Integration**: Longer streaks offer game-specific progression advantages, keeping players incentivized to log in daily.
4. **WebGL Rendering Constraints**:
   - Only direct WebGL rendering on the single `#incrementalist` canvas is allowed.
   - **No offscreen canvas workarounds or surface compositions!**
   - Designs must be premium yet visually basic and representational (colors, lines, moving bars, text labels) to avoid massive texture maps.

---

## Step-by-Step Porting Sequence

We will implement each game systematically as follows:

1. **01_reward_labyrinth.md**: Explorer maze with step budget `steps = rand(4, 10) + min(streak / 15, 20)`.
2. **02_ladder_climb.md**: Rung climber with declining chances, with streak boosting climb rolls by up to 1 percentage point (`min(streak / 60, 100) percentage points`).
3. **03_lucky_dice.md**: 7x7 poker dice with keep-and-reroll mechanism and streak rolls `1 + min(floor(streak / 30), 2)`.
4. **04_scratch_card.md**: Scratch 1000x500 surface using a brush with release penalty, where max streak unlocks up to 35% of scratch capability.
5. **05_card_pick.md**: 6x6 card grid using the one-shot logic of `its_bonus_time` (single token-spend precalculating total picks and multipliers, with local interactive reveals).
6. **06_match_pairs.md**: Memory game with 24 pairs, turn limit `4 + min(streak // 15, 6)`, and automatic last-turn flip consolation.
7. **07_hammer_smash.md**: Volatility striker with moving bar, streak-based floor `min_amount = 5 + min(streak / 15, 15)`, and double-100% bell breaks.
