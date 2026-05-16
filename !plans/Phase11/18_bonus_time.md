# Phase 11, Step 18: Bonus Time

## Objective
Implement the "Bonus Time" multiplier state and visual countdown.

## Implementation
- **Server Rules**: Add `bonus_time_rules.ex` to `lib/incrementalist/game/features/daily_bonus/`.
  - Implement `apply_bonus_multiplier(value, state)`: Doubles specific rewards if `bonus_time` is active.
- **Client Render**: Add `bonus-time.ts` to `assets/src/features/daily-bonus/render/`.
  - Render a basic timer box (colored rectangle) with a text countdown.
  - Use simple text color changes to indicate urgency.
- **Client Interaction**: Automatically active when tokens are > 0.
- **Reveal**: Simple "Bonus Active" / "Expired" label changes.

## Aesthetic Note
Implementations must be visually basic. Use representational boxes and text labels.

## Verification
- Bonus multiplier is correctly applied to rewards during the active window.
- Countdown timer matches the server's expiration timestamp.
