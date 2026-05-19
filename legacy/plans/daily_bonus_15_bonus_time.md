# Bonus time!

## Summary

There is a big board of 16x8 tiles facing down.
The board always contains exactly one `tier_7` tile.

The user gets to flip cards.

## Streak Relation

flips = number_of_bonus_events_played_past_week + min(streak / 30, 5)

The streak adds up to 5 extra flips, while recent bonus activity adds the rest. Each flipped tile grants the placeholder reward tier hidden on that tile.

## Reward Tiers

Create the board by placing exactly one `tier_7` tile at a random position first. The remaining 127 tiles roll from the tier 1-6 chances below. This gives a `100%` chance that the board contains one `tier_7` tile and no chance for a second `tier_7` tile.

| Tier | Tile outcome | Board generation chance | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Common tile | `56%` of non-`tier_7` tiles | `tier_1` |
| 2 | Uncommon tile | `25%` of non-`tier_7` tiles | `tier_2` |
| 3 | Rare tile | `10%` of non-`tier_7` tiles | `tier_3` |
| 4 | Excellent tile | `6%` of non-`tier_7` tiles | `tier_4` |
| 5 | Unique tile | `3%` of non-`tier_7` tiles | `tier_5` |
| 6 | Exotic tile | `1%` of non-`tier_7` tiles | `tier_6` |
| 7 | Ultimate tile | Exactly 1 tile per board | `tier_7` |
