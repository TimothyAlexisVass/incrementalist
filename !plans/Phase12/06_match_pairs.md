# Phase 12, Step 6: Match Pairs

## Objective
Port Match Pairs to server-authoritative session rules and WebGL rendering as a later bonus-session game, with pair validation and reveal order fully controlled by the server.

## Implementation
- **Server Rules**: Add `match_pairs.ex` to `lib/incrementalist/game/features/bonustime/games/`.
  - Implement `start_session(seed)`: Create the shuffled hidden board and the pairing session state.
  - Implement `submit_pairs(session, pair_indexes)`: Validate the requested pairs against the active phase and calculate the reveal outcomes server-side.
- **Client Render**: Add `match-pairs.ts` to `assets/src/features/bonustime/match-pairs/render.ts`.
  - Render a basic grid of hidden cards or tiles.
  - Highlight matched cards and mismatched attempts with simple border or label changes.
- **Client Interaction**: Send paired indexes only. The client keeps hover/selection state local.
- **Reveal**: Reveal matched pairs only after the server accepts the pair submission, then advance or complete the session.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text labels. Avoid hidden-board shortcuts or any offscreen composition paths.

## Verification
- Pair validation is fully server authoritative.
- Hidden board state is never serialized before reveal.
- Match resolution follows the server-owned session phase order.
