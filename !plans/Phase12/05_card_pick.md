# Phase 12, Step 5: Card Pick

## Objective
Port Card Pick to server-authoritative session rules and WebGL rendering as a later bonus-session game, keeping the revealed board state server-owned and the selected cards as client-side intent only.

## Implementation
- **Server Rules**: Add `card_pick.ex` to `lib/incrementalist/game/features/bonustime/games/`.
  - Implement `start_session(streak)`: Create the hidden 6x6 board and initial pick count from the server-owned streak.
  - Implement `reveal_selection(session, picked_count)`: Validate the picked count against the active session phase and calculate all reveal results server-side.
- **Client Render**: Add `card-pick.ts` to `assets/src/features/bonustime/card-pick/render.ts`.
  - Render a basic 6x6 grid of representational cards.
  - Show selected cards, revealed cards, and missed cards with simple color or label changes.
- **Client Interaction**: Send reveal intent with the picked count only. The board positions clicked by the player stay as UI state.
- **Reveal**: Show the picked cards first, then the missed cards, so the player can see what was where without receiving hidden outcomes early.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text labels. Avoid detailed card art or any offscreen reveal shortcuts.

## Verification
- Hidden card outcomes are not serialized before reveal.
- Selected indexes remain UI intent only.
- Reveal order matches the server response exactly.
