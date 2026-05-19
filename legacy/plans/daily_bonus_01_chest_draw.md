# Chest Draw

## Rotation

- Rotation slot: 1 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 1.
- Type: Pure chance
- Core interaction: Roll a chest rarity
- Reward status: Placeholder rewards only

## Summary

The player spends one bonus token and opens at least one chest. The game is a direct rarity roll with a short reveal sequence.

## Streak Relation

The streak adds extra chest rolls before the reward is granted.

`chest_rolls = 1 + min(floor(streak / 60), 2)`

Each roll uses the same rarity odds below. The player receives the highest tier rolled, so the rarity table stays unchanged while longer streaks give more chances to hit it.

## Interaction Flow

- Show one closed chest.
- Player presses `Open Chest`.
- Chest plays a short shake/glow/reveal animation for each roll.
- The best result reveals one chest rarity.
- The best result grants the placeholder reward attached to that rarity tier.

## Rarity Odds

| Tier | Rarity | Chance per roll | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Standard Chest | `50%` | `tier_1` |
| 2 | Rare Chest | `35%` | `tier_2` |
| 3 | Remarkable Chest | `10%` | `tier_3` |
| 4 | Exotic Chest | `4%` | `tier_4` |
| 5 | Supreme Chest | `0.9%` | `tier_5` |
| 6 | Ultimate Chest | `0.09%` | `tier_6` |
| 7 | Impossible Chest | `0.01%` | `tier_7` |

## Design Notes

- This is intentionally the simplest daily bonus game.
- The rare-hit fantasy comes from the rarity names, odds, and reveal effects.
- Spending a token always produces at least one chest result.
- Placeholder reward IDs are not final reward names, amounts, or economy decisions.
