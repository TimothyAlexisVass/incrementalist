# Phase 11, Step 17: Jackpot Meter

## Objective
Implement the progressive Jackpot Meter system with server-authoritative tracking.

## Implementation
- **Server Rules**: Add `jackpot_rules.ex` to `lib/incrementalist/game/features/bonustime/`.
  - Implement `increment_meter(state, amount)`: Persists progress and handles jackpot rolls when full.
- **Client Render**: Add `jackpot-meter.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a representational meter (row of 7 boxes).
  - Use color changes or borders to show "filling" state.
- **Client Interaction**: Meter is updated automatically based on play results.
- **Reveal**: Highlight the jackpot box when the 7th segment is reached.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and color changes.

## Verification
- Meter progress matches the server's `bonustime.jackpot_progress`.
- Jackpot reward is granted upon the 7th increment.
