# Match Pairs

## Rotation

- Rotation slot: 8 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 8.
- Type: Light skill
- Core interaction: Flip tiles and find pairs
- Reward status: Placeholder rewards only

## Summary

The player flips hidden tiles and tries to find matching pairs before the event ends. This is a compact memory game.

## Interaction Flow

- Show 48 tiles face down.
- The board contains 24 pairs.
- Player flips 1 tile at a time.
- Matching pairs stay face-up.
- Non-matches flip back after a short delay.
- Event ends when all pairs are found or the turn limit is reached.

## Streak Relation

flips = 4 + min(streak // 15, 6)

Longer streaks give more flips before the turn limit is reached.

If the player hasn't matched a pair on the last flip, the matching tile to the last flip will also flip, so the player gets at least 1 reward.

## Reward Tiers

The board contains 24 spawned pairs. Each pair rolls its tier from this table. Matched pairs grant the placeholder reward tier assigned to that pair.
The `tier_7` chance is per spawned pair, giving about a `1%` chance that a 24-pair board contains at least one `tier_7` pair.

| Tier | Pair type | Chance per pair | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Common pair | `62.9581%` | `tier_1` |
| 2 | Uncommon pair | `25%` | `tier_2` |
| 3 | Rare pair | `8%` | `tier_3` |
| 4 | Excellent pair | `3%` | `tier_4` |
| 5 | Unique pair | `0.8%` | `tier_5` |
| 6 | Exotic pair | `0.2%` | `tier_6` |
| 7 | Ultimate pair | `0.0419%` | `tier_7` |
