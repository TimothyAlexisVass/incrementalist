# Jackpot Meter

## Rotation

- Rotation slot: 14 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 14.
- Type: Persistent chance
- Core interaction: Try for the jackpot, otherwise increase future jackpot chance and roll consolation
- Reward status: Placeholder rewards only

## Summary

The player spends one bonus token and makes one jackpot attempt.
The jackpot attempt either hits and grants `tier_7`, or misses and increases the stored jackpot chance by `0.5 percentage points` for the next Jackpot Meter appearance.

When the jackpot misses, the player still gets a consolation roll for a `tier_1` through `tier_6` prize. `tier_1` is guaranteed as the minimum consolation result.

## Streak Relation

The streak improves the base jackpot chance.

`base_chance = 0.5% + min(floor(streak / 100), 1)%`

## Persistent Jackpot Chance

`jackpot_chance = min(100%, base_chance + (jackpot_misses_since_hit * 1 percentage points))`

On a jackpot hit:

- Grant `tier_7`.
- Reset `jackpot_misses_since_hit` to `0`.

On a jackpot miss:

- Increase `jackpot_misses_since_hit` by `1`.
- This increases the next Jackpot Meter chance by `0.5 percentage points`.
- Roll the consolation prize.

## Interaction Flow

- Show the current jackpot chance before the token is spent.
- Player presses `Try Jackpot`.
- Roll against the current jackpot chance.
- If the jackpot hits, reveal the `tier_7` prize and reset the meter.
- If the jackpot misses, show the `+0.5%` future chance increase.
- After a miss, roll and reveal the consolation prize.
- The consolation prize grants its placeholder reward tier.

## Consolation Roll

The consolation roll only happens after a jackpot miss.
It cannot grant `tier_7`; the `tier_7` prize only comes from the jackpot roll.
If the streak floor is higher than the rolled consolation tier, the player receives the streak floor instead.

| Tier | Consolation outcome | Chance on jackpot miss | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Baseline consolation | `55%` | `tier_1` |
| 2 | Small consolation | `25%` | `tier_2` |
| 3 | Medium consolation | `10%` | `tier_3` |
| 4 | Large consolation | `6%` | `tier_4` |
| 5 | Rare consolation | `3%` | `tier_5` |
| 6 | Excellent consolation | `1%` | `tier_6` |
