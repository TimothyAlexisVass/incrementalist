# Checklist

## Rotation

- Rotation slot: 3 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 3.
- Type: Deterministic progress
- Core interaction: Claim the next known checklist entry
- Reward status: Placeholder rewards only

## Summary

The player sees a 15-entry checklist and spends one token to complete the next unchecked entry. The next result is visible before spending the token.

## Streak Relation

Checklist games are the exception: streak does not change the result. Progress is tied to the persistent checklist position, and the next tier is known before spending the token.

## Interaction Flow

- Show all 15 checklist entries.
- Highlight the next unchecked entry.
- Player presses `Check Off`.
- The highlighted entry becomes complete.
- After entry 15 is completed, the checklist resets for the next cycle.

## Placeholder Checklist

| Entry | Placeholder reward |
| ---: | --- |
| 1 | `tier_1` |
| 2 | `tier_1` |
| 3 | `tier_1` |
| 4 | `tier_2` |
| 5 | `tier_2` |
| 6 | `tier_2` |
| 7 | `tier_3` |
| 8 | `tier_3` |
| 9 | `tier_3` |
| 10 | `tier_4` |
| 11 | `tier_4` |
| 12 | `tier_4` |
| 13 | `tier_5` |
| 14 | `tier_6` |
| 15 | `tier_7` |

## Design Notes

- This is not random.
- The next result must be obvious before the player commits.
- Progress should persist between appearances.
- This should feel like steady attendance progress, not gambling.
- Placeholder reward IDs are not final reward names, amounts, or economy decisions.
