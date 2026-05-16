# Phase 11, Step 17: Jackpot Meter

## Objective
Port the Jackpot Meter mini-game to server-authoritative rules and WebGL rendering.

## Implementation
- **Server Rules**: Add `jackpot_meter.ex` to `lib/incrementalist/game/features/daily_bonus/games/`.
  - Implement `roll_jackpot(current_misses, streak)`: Checks for Tier 7 hit or increments the miss counter.
  - Implement `roll_consolation()`: Generates a Tier 1-6 reward on miss.
- **Client Render**: Add `jackpot-meter.ts` to `assets/src/features/daily-bonus/render/`.
  - Display the current jackpot percentage prominently.
  - Animate the jackpot attempt and the "miss" increment or "hit" celebration.
- **Client Interaction**: `Try Jackpot` button.
- **Reveal**: Display the outcome (Hit/Miss) and any consolation rewards.

## Verification
- Persistent jackpot chance is correctly stored and incremented in the save state.
- Tier 7 is only granted on a successful jackpot roll.
