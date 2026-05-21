# Plan: UI Copy and HUD Redaction

## Goal

Remove internal mechanics leakage and misleading status text from player-facing UI.

## Scope

- `assets/src/features/bonustime/12-scratch-card/render.ts`

## Implementation Plan

1. Remove explicit mechanics disclosure text from welcome copy:
   - delete lines that explain location being cosmetic and cumulative threshold internals.
2. Remove raw internal HUD telemetry:
   - remove `Scratched: X / Y px`
   - remove `Next reveal in ... px`
3. Remove premature terminal messaging:
   - remove `All reveals unlocked` line entirely
4. Keep only neutral, player-safe UI cues (title, visual progress treatment, and board feedback).

## Verification

1. Enter scratch card and confirm no text exposes pixel counters or threshold mechanics.
2. Confirm there is no intermediate "all unlocked" message before run completion.
3. Confirm UI still communicates that the game is active without confusing internals.

## Risk Notes

- Removing too much copy can make the state feel empty, so keep minimal neutral guidance.
