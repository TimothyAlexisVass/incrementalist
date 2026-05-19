# Coin Rain

## Rotation

- Rotation slot: 5 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 5.
- Type: Light skill
- Core interaction: Catch falling objects for a short timer
- Reward status: Placeholder rewards only

## Summary

The player has a short action window to catch a rain of falling objects of varying speeds.
The player has a bucket at the bottom of the screen to collect things in.
The player can move the bucket vertically

## Streak Relation

The action window (timer) is decided by Streak and random chance.

timer = random(5, 8) + round(streak / 50, 2) [seconds]
bucked_width = random(30, 50) + min(streak // 10, 30) [pixels]
bucket_speed = random(100, 300) + min(streak, 200) [pixels_per_second]

Longer streaks increase the timer, bucket width, and bucket speed before the collection tier is scored.

Items that touch the portal are collected

## Interaction Flow

- Player first rolls the timer, portal_radius and portal_speed
- There is a countdown, 3... 2... 1... GO!
- Coins spawn and fall from the top of the screen as long as the timer is going
- Player catches coins with the bucket
- When time ends, caught coins are collected
- There is a chance that a tier1-7 reward is spawned instead of a coin.
- The fall speed of tier1-7 rewards depend on the tier
- Tier 1 reward is twice as fast as coins
- Tier 2 reward is 3 times as fast, etc...
- Tier 7 reward is instant, so fast you would have to have the bucket right there to catch it

## Tier chances

Each item spawn rolls directly against this table. If no reward tier hits, a normal coin spawns.
At roughly 20 spawns per second for a 10 second max-streak game, the `tier_7` chance is about `0.1%` across the full run.

| Tier | Falling reward | Chance per item spawn | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Tier 1 reward | `0.5%` | `tier_1` |
| 2 | Tier 2 reward | `0.2%` | `tier_2` |
| 3 | Tier 3 reward | `0.08%` | `tier_3` |
| 4 | Tier 4 reward | `0.03%` | `tier_4` |
| 5 | Tier 5 reward | `0.01%` | `tier_5` |
| 6 | Tier 6 reward | `0.002%` | `tier_6` |
| 7 | Tier 7 reward | `0.0005%` | `tier_7` |
