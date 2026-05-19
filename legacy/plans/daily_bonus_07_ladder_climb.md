# Ladder Climb

## Rotation

- Rotation slot: 7 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 7.
- Type: Upgrade choice
- Core interaction: Try to advance up a visible reward ladder
- Reward status: Placeholder rewards only

## Summary

The player climbs a visible ladder of increasingly difficult advancement steps.
Each step has a reward.

## Streak Relation

The streak adds a percent point advancement bonus to each climb roll.

`climb_chance_multiplier = min(streak / 60, 100) percentage points`

So if the regular chance is 1%, it becomes 2% with maximum streak bonus.

Apply this to the base advancement chance, capped at `100%`. The reward ladder still has seven placeholder tiers.

## Interaction Flow

- Show the full ladder.
- Step 1 is guaranteed.
- Chance is rolled every time the user clicks `Climb`.
- There is an 80% chance to reach step 2.
- There is a 50% chance to reach step 3, after reaching step 2. So there is a 40% chance to get 3 rewards.
- There is a 25% chance to reach step 4, after reaching step 3. So there is a 10% chance to get 4 rewards.
- There is a 10% chance to reach step 5, after reaching step 4. So there is a 1% chance to get 5 rewards.
- At each step, player can click `Climb` where there is a declining chance to advance to the next rung
- A successful climb moves the marker up one step.
- A missed climb ends the game at the current step.
- The current step grants its placeholder reward.

## Ladder Steps

| Tier | Step | Base advancement chance to reach it | Placeholder reward |
| ---: | ---: | ---: | --- |
| 1 | 1 | `100%` | `tier_1` |
| 2 | 2 | `80%` | `tier_2` |
| 3 | 3 | `50%` | `tier_3` |
| 4 | 4 | `25%` | `tier_4` |
| 5 | 5 | `10%` | `tier_5` |
| 6 | 6 | `5%` | `tier_6` |
| 7 | 7+ | `1%` | `tier_7` |

## Design Notes

- The full 20 rung ladder path should be visible.
- The current step is locked in once reached.
- Spending a token always produces at least step 1.
- Placeholder reward IDs are not final reward names, amounts, or economy decisions.
