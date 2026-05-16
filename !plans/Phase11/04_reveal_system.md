# Phase 11, Step 4: Reveal System

## Objective
Standardize how bonus rewards are visually presented to the player using WebGL.

## Implementation
- **Effect Bus**: Use the existing WebGL burst system (or create a new one in `assets/src/render/effects/`).
- **Logic**: Trigger a reward reveal sequence when a `daily_bonus.play` command returns a success.
- **Visuals**: Implement "Currency Fly-in" effects where coins/shards fly from the center of the bonus game to the player's currency counters.
- **Sound**: Trigger the legacy reward sound effects via the event bus.

## Verification
- Visual feedback is immediate and satisfying upon claiming rewards.
- Effects do not block subsequent UI interactions.
