# Card Pick

## Rotation

- Rotation slot: 4 of 15
- Fixed schedule: None
- Timing rule: Active when the 12-hour rotation cursor points to slot 4.
- Type: Hidden choice
- Core interaction: Choose hidden cards from a 36-card board
- Reward status: Placeholder rewards only

## Summary

The player sees 36 face-down cards in a 6x6 board. The initial selection starts at 2 cards, then gains +1 card per 7 streak, capped at 9 cards. The chosen cards reveal first, then the unpicked cards reveal afterward for comparison and drama. If the player collects at least one reward when the session completes, that daily play improves their streak.

## Streak Relation

`initial_picks = 2 + min(7, floor(max(0, streak) / 7))`

The streak increases how many cards the player can select before the first reveal. This gives 2-9 initial picks.

`bonus_chance = 0.2 + 0.8 * streak / 77`

Every time the cards are revealed, there is a 20% chance that they get a bonus chance at streak 0, then it goes up until passing 100% at streak 77.
When they get a bonus chance, the remaining cards get their rewards doubled and are re-shuffled before the player can choose one of the remaining cards. The player then gets a fixed streak independent 10% chance to get the rewards are doubled again, remaining cards shuffled and they get to pick again! After that, when the player picks a card, instead of revealing immediately, they have a 5% chance to pick another card, after that, before revealing, they have a 5% chance to pick a third card, etc. If a player is unbelievably lucky, they could literally get to pick all of the remaining cards.

## Interaction Flow

- Show 36 face-down cards. (6x6 grid)
- Player selects `initial_picks` cards.
- If the player has a streak of 77 or higher, they have at least a 100% chance to get a bonus pick; otherwise the chance follows `bonus_chance`.
- The selected cards flip and resolve.
- The remaining cards flip afterward to show what the player "missed".
- Each selected card grants its placeholder reward.
- If the player has a bonus pick, all the rewards are visibly doubled, shuffled and the player gets to choose another card.
- After the player gets the bonus pick resolved, they have a 10% chance to get another bonus pick, no matter what their streak is.
- After that, they have 5% chance for consecutive bonus picks, but without reveal or shuffle until all those bonus picks have been resolved.

## Placeholder Card Pool

Each card is random rolled

| Tier | Card outcome | Chance | Placeholder reward |
| ---: | --- | ---: | --- |
| 1 | Common Card | `61.3%` | `tier_1` |
| 2 | Rare Card | `20%` | `tier_2` |
| 3 | Elite Card | `10%` | `tier_3` |
| 4 | Excellent Card | `5%` | `tier_4` |
| 5 | Unique Card | `2.5%` | `tier_5` |
| 6 | Exotic Card | `1%` | `tier_6` |
| 7 | Ultimate Card | `0.2%` | `tier_7` |

## Design Notes

- The player cannot know which card is best.
- The fun comes from choosing and revealing.
- Revealing unpicked cards afterward should show what might have happened.
- Placeholder reward IDs are not final reward names, amounts, or economy decisions.
