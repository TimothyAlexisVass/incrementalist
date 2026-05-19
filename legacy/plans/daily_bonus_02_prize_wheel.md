# Prize Wheel

## Rotation

- Slot: 2
- UTC window: Mon 12:00
- Type: Pure chance
- Core interaction: Spin a visible wheel
- Reward status: Placeholder rewards only

## Summary

The player spins a wheel with visible slices. The game is watching the wheel slow down and land on one outcome.

## Streak Relation

The streak adds extra spins before the reward is granted.

`wheel_spins = 1 + min(floor(streak / 30), 2)`

Each spin uses the same visible wheel. The player receives the highest tier landed across those spins.

## Interaction Flow

- Show the full wheel before the token is spent.
- Player presses `Spin`.
- The wheel accelerates quickly, then decelerates for each spin.
- The pointer lands on one visible slice each time.
- The best landed slice grants its placeholder reward tier.

## Placeholder Wheel Slices

| Tier | Slice | Chance per spin | Placeholder reward |
| ---: | --- | ---: | --- | --- |
| 1 | Common Hit | `50%` | `tier_1` |
| 2 | Small Hit | `30%` | `tier_2` |
| 3 | Medium Hit | `12%` | `tier_3` |
| 4 | Large Hit | `5%` | `tier_4` |
| 5 | Lucky Hit | `2%` | `tier_5` |
| 6 | Bonus Hit | `0.97%` | `tier_6` |
| 7 | Jackpot | `0.03%` | `tier_7` |

## Design Notes

- Slice sizes encode the odds above.
- The wheel should be readable in a compact modal.
- The player should be able to see the full possibility space before spinning.
- Placeholder reward IDs are not final reward names, amounts, or economy decisions.
