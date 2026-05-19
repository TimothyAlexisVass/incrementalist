# 7x7 Dice

## Rotation

- Rotation slot: 11 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 11.
- Type: Pure chance
- Core interaction: Roll dice with special combinations
- Reward status: Placeholder rewards only

## Summary

The player rolls seven 7 sided dice.
They get to keep any amount of dice or take reward, and roll again as long as they have rolls left.
If they take the reward, they get to re-roll all of the dice again.

rolls = 1 + min(floor(streak / 30), 2)

## Interaction Flow

- Player presses `Roll`.
- seven 7-sided dice animate
- The dice settle on final values.
- The player can choose to claim reward (if any) or to save specific dice and only reroll the rest.
- If the player chooses to claim reward, they get to reroll all the dice if they still have rolls left, for a chance of another reward.

## Chances

Rank	Combination	Count	Chance	Reward
Tier 1
1	Two pairs	264,600	32.1295%	tier_1
2	Full house	176,400	21.4196%	tier_1
3	Three pairs	88,200	10.7098%	tier_1
4	Three-of-a-kind	88,200	10.7098%	tier_1
5	A single pair	75,600	9.1800% 	tier_1
Tier 2
6	Small straight	30,240	3.6719%	tier_2
7	Four-of-a-kind	29,400	3.5699%	tier_2
Tier 3
8	Full house with two pairs	22,050	2.6775%	tier_3
9	Four/kind + pair	22,050	2.6775%	tier_3
Tier 4
10	Two triples	14,700	1.7850%	tier_4
Tier 5
11	Full straight	5,040	0.6120%	tier_5
12	Five-of-a-kind	4,410	0.5355%	tier_5
Tier 6
13	Four + three	1,470	0.1785%	tier_6
14	Five + pair	882	0.1071%	tier_6
15	Six-of-a-kind	294	0.0357%	tier_6
Tier 7
16	Seven-of-a-kind	0.00085%	tier_7
