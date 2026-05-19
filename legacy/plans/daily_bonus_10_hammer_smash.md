# Hammer Smash

## Rotation

- Rotation slot: 10 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 10.
- Type: Volatility choice
- Core interaction: Choose safe, balanced, or wild
- Reward status: Placeholder rewards only

## Summary

The player gets to smash a button with a hammer.
There is a meter which is moving from min_amount% to 100% back and forth.
When the player clicks, the meter keeps moving for a random amount between 30-200%
The meter status determines the power of the smash.
It's like one of those tivoli hammer smash a button to shoot a thing up a pole event.
The user gets 2 smashes.
Each smash sends the marker up the pole by half of the smash power.

`pole_height = min(100, (smash_1_power / 2) + (smash_2_power / 2))`

## Streak Relation

min_amount = 5 + min(streak / 15, 15)

Longer streaks raise the minimum meter value, improving the floor before the player times each smash.

## Interaction Flow

- Player presses `Smash` while the meter is moving.
- The meter keeps moving for a random amount between 30-200%.
- The final meter value becomes the smash power.
- Each normal smash adds half of its smash power to the pole height.
- After 2 normal smashes, the final pole height grants the matching reward tier.
- If both normal smashes are `100%`, the marker reaches the bell at the top.
- Hitting the bell grants `tier_7` and unlocks one extra smash.
- The extra smash is a bell-break attempt.
- If the extra smash breaks the bell, the player receives an extra reward in addition to `tier_7`.

## Reward Tiers

The streak increases the minimum meter value through `min_amount`, making the lower pole tiers easier to skip. The normal reward tier comes from the final pole height after the 2 normal smashes.

| Tier | Pole height after normal smashes | Placeholder reward |
| ---: | --- | --- |
| 1 | `0%` to `<15%` | `tier_1` |
| 2 | `15%` to `<30%` | `tier_2` |
| 3 | `30%` to `<60%` | `tier_3` |
| 4 | `60%` to `<75%` | `tier_4` |
| 5 | `75%` to `<90%` | `tier_5` |
| 6 | `90%` to `<100%` | `tier_6` |
| 7 | `100%`, bell hit | `tier_6` + "smash the bell" chance |

## "Smash the bell" chance

The extra smash only happens after the player hits the bell. Its reward is extra and does not replace the `tier_6` bell reward.

| Extra smash outcome | Extra placeholder reward |
| --- | --- |
| `<50%` extra smash power: bell cracks | `tier_4` |
| `50%` to `<75%` extra smash power: bell cracks a lot | `tier_5` |
| `75%` to `<90%` extra smash power: bell breaks | `tier_6` |
| `>90%` extra smash power: bell shatters perfectly | `tier_7` |
