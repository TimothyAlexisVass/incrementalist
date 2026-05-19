# Daily Bonus Game Plan

## Core Shape

- A bonus token lets the player play one bonus game.
- Bonus tokens have two types:
  - `daily`
  - `special`
- The active daily bonus game changes every 12 hours at `00:00 UTC` and `12:00 UTC`.
- There are 15 daily bonus games, so the full rotation takes 7.5 days.
- Because the rotation is longer than one week by one 12-hour slot, each game drifts between `00:00 UTC` and `12:00 UTC` across later weeks.
- No game has a fixed weekday or 12-hour window.
- At each `00:00 UTC` and `12:00 UTC` boundary, the player receives `+1 daily bonus token` only if they currently have `0 daily bonus tokens`.
- This document is about the games themselves, not reward balancing.

## Game Design Goals

- Each game should fit in a compact modal or panel.
- Each game should resolve quickly.
- The player should do at least one small thing after spending the token.
- The 15 games should not all feel like the same random roll with different art.
- Some games should be pure luck, some should be choice-based, some should be light skill, and two should be deterministic checklist-style games.
- Deterministic games should show exactly what will happen before the player commits.
- No bonus game should have losing outcome. A low roll can stop an upgrade, land on the lowest tier, or pay only the baseline result, but spending a token should always produce something.
- Every bonus game resolves through seven placeholder reward tiers: `tier_1` through `tier_7`.
- Every non-checklist bonus game should have a clear streak relation. Checklist games are the exception because their progression is already tied to the persistent checklist position.

## Streak

Every day the user will improve their streak by 1 if they play at least one game.
They can increase their streak by a maximum of 1 per day.
If the streak is broken, it is reduced by 3 to a minimum of 0.
Each non-checklist bonus game uses streak differently: more attempts, more control, longer timers, better floors, or extra reveal chances. These effects should remain game-specific rather than using one global streak formula.

## Rotation Tracking

The UTC clock only supplies 12-hour boundaries. The active game comes from a rotation cursor, not from a per-game schedule.

Track the active slot from a single UTC anchor boundary:

- `rotationAnchorUtc`: a chosen `00:00 UTC` or `12:00 UTC` boundary where slot 1 starts.
- `boundaryIndex`: number of 12-hour boundaries elapsed since `rotationAnchorUtc`.
- `activeSlot`: `(boundaryIndex % 15) + 1`.
- `nextSlot`: `(activeSlot % 15) + 1`.
- `nextChangeAt`: `rotationAnchorUtc + ((boundaryIndex + 1) * 12 hours)`.

Token grants should use the same 12-hour boundary cadence. The grant check and the active-slot calculation can share the boundary counter, but games should not store fixed per-game schedules.

## Rotation Order

Every time the user spends a reward token, they get a Bonus time!-flip up to a maximum of 14.

After slot 15, the rotation loops back to slot 1 at the next 12-hour boundary.
