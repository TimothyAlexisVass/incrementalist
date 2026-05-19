# Reward Labyrinth

## Rotation

- Rotation slot: 6 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 6.
- Type: Hidden choice
- Core interaction: Explore a labyrinth and find random reward items
- Reward status: Placeholder rewards only

## Summary

The player starts outside a labyrinth and can choose `Enter`.
The player continues to walk until reaching a wall at which point they can choose left or right if those are available. If only left or right is available, they can only choose that. If they have reached a dead end, they have to choose "back".
The labyrinth has no exit and the player must not be able to back out. There must always be a left + right path after entering. If the player did not find anything, they get a consolation price.
The labyrinth contains `rand(5, 10)` reward items spawned at random locations.

## Streak Relation

steps = rand(4, 10) + min(streak / 15, 20)

Longer streaks give more movement steps inside the labyrinth, increasing the chance to find randomly placed reward items before the run ends.

## Interaction Flow

- Player presses `Enter`.
- The player chooses left, right, forward, or back depending on the available paths.
- The labyrinth reveals one choice at a time.
- Reward items can appear at random locations on paths or dead ends.
- When the step budget is spent, the best found reward tier is granted.
- If no reward item was found, the player receives `tier_1`.

## Reward Tiers

Each reward item spawned in the labyrinth rolls its tier from this table. There is no depth logic; location does not change the reward tier. If no reward item was found, the existing consolation rule still grants `tier_1`.

| Tier | Labyrinth item | Chance per spawned item | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Common item | `55%` | `tier_1` |
| 2 | Uncommon item | `25%` | `tier_2` |
| 3 | Rare item | `12%` | `tier_3` |
| 4 | Excellent item | `5%` | `tier_4` |
| 5 | Unique item | `2%` | `tier_5` |
| 6 | Exotic item | `0.9%` | `tier_6` |
| 7 | Ultimate item | `0.1%` | `tier_7` |
