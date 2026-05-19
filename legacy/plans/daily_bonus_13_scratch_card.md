# Huge scratch card

## Rotation

- Rotation slot: 10 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 10.
- Type: Hidden choice
- Core interaction: Reveal covered symbols
- Reward status: Placeholder rewards only

## Summary

The player can scratch on a huge scratch card 1000x500 pixels, with an 8x16 pixels rectangular scratcher.
They get a certain amount of pixels that they can remove and after fully revealing an item, they get that item.
The scratch card contains 10 hidden items.

Lifting the scratcher reduces the number of pixels they can remove by 20000.

## Streak Relation

pixels = 500000 * (rand(0.10, 0.20) + min(streak * 0.01, 0.15))

At maximum streak bonus, they can scratch up to 35% of the card.

## Interaction Flow

- Player can move around the rectangular scratcher
- While holding down, pixels fall off from the card
- If the player releases the mouse button, 20000 pixels are subtracted from how much they can scratch
- When an item is fully revealed, the player receives that item

## Reward Tiers

The scratch card contains 10 spawned hidden items. Each item rolls its tier from this table. Fully revealed items grant their assigned placeholder reward tier.
The `tier_7` chance is per spawned hidden item, giving about a `1%` chance that a 10-item scratch card contains at least one `tier_7` item.

| Tier | Hidden item outcome | Chance per hidden item | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Common hidden item | `62.8995%` | `tier_1` |
| 2 | Uncommon hidden item | `25%` | `tier_2` |
| 3 | Rare hidden item | `8%` | `tier_3` |
| 4 | Excellent hidden item | `3%` | `tier_4` |
| 5 | Unique hidden item | `0.8%` | `tier_5` |
| 6 | Exotic hidden item | `0.2%` | `tier_6` |
| 7 | Ultimate hidden item | `0.1005%` | `tier_7` |
