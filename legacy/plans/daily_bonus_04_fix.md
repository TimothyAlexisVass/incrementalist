# Card Pick Fix Plan

The current implementation treats Card Pick as a one-shot roll: pressing Pick Cards spends the token, auto-selects random card indexes, precomputes bonus phases, advances the streak, records one reward, and starts a reveal animation. That misses the core hidden-choice game. Replace the broken flow directly; do not add backwards compatibility or save-game compatibility for the current Card Pick result shape.

## Implementation Step 1: Lock the Rules Contract [Completed]

- Resolved the plan conflict by defining the initial selection count as `initial_picks = 2 + min(7, floor(max(0, streak) / 7))`, giving 2-9 picks.
- Kept the 36-card, 6x6 hidden board as the core interaction and exposed shared code constants for that contract.
- Defined Card Pick as an interactive session: starting a session spends one token, creates the hidden board, and captures `streakBefore`; rewards are not granted by the start action.
- Defined streak advancement for the future stateful flow: the streak advances only when the session completes after collecting at least one selected-card reward.

## Implementation Step 2: Split Card Pick Into Session Actions [Completed]

- Stop `playDailyBonus` / `rollDailyBonusGame` from fully resolving Card Pick when the player presses Pick Cards.
- Add a Card Pick start action that validates and spends a token, captures `streakBefore`, creates the session, and builds the initial hidden board.
- Add separate actions for selecting cards, confirming the current selection, revealing selected cards, revealing missed cards, starting a bonus phase, and completing the session.
- Keep the existing one-shot path for other daily bonus games, but route Card Pick through its own stateful path.
- Move Card Pick reward/stat/streak mutation out of the start action and into final session completion.

## Implementation Step 3: Make the Board the Source of Truth [Completed]

- Generate the 36 card outcomes first and store them as the hidden board.
- Remove the current rolls-first flow where outcomes are generated separately and shoved into random board indexes.
- Treat `selectedCardIndexes` as player-chosen indexes only.
- Derive selected rewards, best tier, rarity, and reward summary from the chosen board cards.
- Track multipliers on board cards or phase state so doubled rewards come from the visible board state.

## Implementation Step 4: Add Card Selection Input [Completed]

- Add card hit detection for the 6x6 board in `src/game/daily-bonus/games/card-pick/render.js` or a shared Card Pick layout helper.
- Extend the daily bonus modal state in `src/game/game.js` so it can store the active Card Pick session, selected indexes, current phase, and reveal state.
- Make individual cards clickable before reveal.
- Support selecting and deselecting unrevealed cards until the current phase requires confirmation.
- Validate too few selections, too many selections, duplicate indexes, and selecting already resolved cards.
- Add clear progress feedback for "select X cards" and how many picks remain.

## Implementation Step 5: Replace the Button Flow [Completed]

- Change Pick Cards so it starts the Card Pick session instead of resolving it.
- Reveal each card as it is picked.
- Reveal unpicked cards afterward as missed cards for comparison.
- Show Done only after all normal and bonus phases are resolved.

## Implementation Step 6: Implement Bonus Phases Interactively [Pending]

- Roll the streak-based bonus chance only after the initial selected cards have revealed.
- On bonus success, visibly double the remaining unrevealed rewards, reshuffle their board positions, and prompt the player to pick one remaining card.
- After that bonus pick resolves, roll the fixed 10% chance for another doubled, reshuffled bonus pick.
- After the 10% bonus, roll the 5% consecutive-pick chance before each reveal, allowing additional picks to accumulate until the chain fails or no cards remain.
- Do not precompute all bonus phases inside `rollCardPick`.
- Reveal each bonus pick as it is done.
- Keep bonus selection capped by the number of unresolved remaining cards.

## Implementation Step 7: Render the Full Card Pick State [Pending]

- Render the empty hidden board before any result exists.
- Render missed-card reveal after selected cards finish.
- Render bonus chance success/failure, doubled rewards, reshuffle state, bonus pick prompts, and consecutive-pick prompts.
- Make missed cards visually dimmed at reveal.
- Keep card positions and text stable across the full animation.

## Implementation Step 8: Finalize Rewards, Stats, And Streak [Pending]

- On final completion, collect rewards from every selected card, including multiplier effects from bonus phases.
- Update reward counts for all collected placeholder reward IDs, not only one best reward.
- Preserve a result summary suitable for the modal and last-result display, including selected indexes, selected rewards, phases completed, best tier, and whether bonus phases occurred.
- Advance the streak only after the Card Pick session has actually awarded at least one reward.
- Save the game after completion, not merely after session start, unless session start must persist a spent token.

## Implementation Step 9: Verification [Pending]

- Add focused tests for pick-count calculation, board generation, player-selected indexes, selection validation, reveal ordering, bonus chance thresholds, reshuffle/doubling, reward aggregation, and final streak/stat mutation.
- Manually verify the modal flow: start session, select required cards, confirm reveal, see missed cards, trigger bonus states with controlled random values, complete session, and close with Done.
- Verify that other daily bonus games still use the one-shot flow and still render correctly.
