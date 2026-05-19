# Plinko Drop

## Rotation

- Rotation slot: 12 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 12.
- Type: Pure chance
- Core interaction: Drop a ball through random pegs into a reward cup
- Reward status: Placeholder rewards only

## Summary

The player spends one bonus token and drops at least one ball into a Plinko board.
The ball falls through a compact peg board, randomly bouncing left or right at each peg row until it lands in one of the reward cups at the bottom.

The player does not aim, time, steer, or influence the ball after pressing `Drop`.
The only outcome driver is the random path through the board.

## Streak Relation

The streak adds extra drops before the reward is granted.

`plinko_drops = 1 + min(floor(streak / 45), 2)`

Each drop uses the same peg board and cup layout.
The player receives the highest tier landed across all drops.

## Interaction Flow

- Show the full Plinko board and all bottom reward cups.
- Player presses `Drop`.
- The ball falls through 12 peg rows.
- At each row, the ball randomly bounces left or right.
- The ball lands in one of 13 bottom cups.
- If the player has extra streak drops, repeat the drop animation.
- The highest landed cup grants its placeholder reward tier.

## Board Layout

The board has 12 random bounce rows and 13 bottom cups.
The cups are symmetric, with the rarest rewards on the outside edges and the common rewards near the center.

| Cup position | Tier | Cup outcome | Chance per drop | Placeholder reward |
| ---: | ---: | --- | ---: | --- |
| 1 and 13 | 7 | Edge jackpot cup | `0.0488%` total | `tier_7` |
| 2 and 12 | 6 | Outer premium cup | `0.5859%` total | `tier_6` |
| 3 and 11 | 5 | Outer rare cup | `3.2227%` total | `tier_5` |
| 4 and 10 | 4 | High cup | `10.7422%` total | `tier_4` |
| 5 and 9 | 3 | Medium cup | `24.1699%` total | `tier_3` |
| 6 and 8 | 1 | Small cup | `38.6719%` total | `tier_1` |
| 7 | 2 | Center cup | `22.5586%` | `tier_2` |
