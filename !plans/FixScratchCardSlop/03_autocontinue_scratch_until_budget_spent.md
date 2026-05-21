# Plan: Auto-Continue Scratching Until Budget Is Spent

## Goal

Once scratching starts, progression must continue until the run is complete, even if the player lifts input.

## Scope

- `assets/src/features/bonustime/12-scratch-card/interactions.ts`
- `assets/src/features/bonustime/12-scratch-card/render.ts` (only if visual indicator is needed)
- scratch-card tests in `assets/src/tests/bonustime-flow.test.ts` (or equivalent)

## Implementation Plan

1. Add run-level mode flags:
   - `hasScratchStarted`
   - `autoScratchActive` once first real scratch deduction occurs
2. Implement autonomous scratch stepping during `PLAYING` when input is not pressed:
   - continue deducting scratch budget through deterministic traversal logic
   - keep reveal scheduling and pending reveal resolution active during auto steps
3. Preserve player control priority:
   - manual press/drag input overrides and steers current scratch position when present
   - on lift, resume auto-continue
4. End auto-continue only when both conditions are met:
   - budget exhausted
   - all reveal schedule entries resolved

## Verification

1. Start scratching manually, then release immediately.
2. Confirm progress continues without further input.
3. Confirm run reaches `REVEALED` and opens shared reward flow without requiring extra presses.
4. Confirm no infinite loop or frame hitching during auto traversal.

## Risk Notes

- Must balance deterministic progress with frame-time safety.
- Auto traversal should feel intentional rather than glitchy.
