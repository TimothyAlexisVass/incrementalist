# Plan: Threshold Anchor and Proximity Defer Behavior

## Goal

Honor the reveal rule exactly:

- threshold crossing is determined by cumulative scratch progress
- reveal is performed on the next scratch touch
- reveal placement is anchored to where the player scratches next
- reveal proceeds only if that scratch point is connected to a valid `37x37` unscratched block
- if no such local connected block exists at that touch, reveal remains deferred

## Scope

- `assets/src/features/bonustime/12-scratch-card/interactions.ts`
- `assets/src/tests/bonustime-flow.test.ts` (or targeted scratch-card tests)

## Implementation Plan

1. Keep threshold detection timing authoritative:
   - determine threshold crossing after new scratch cells are deducted
   - do not reveal immediately on crossing touch
2. On the next scratch touch, resolve pending reveal:
   - evaluate only `37x37` reveal blocks that include the current scratch point
   - if no valid `37x37` unscratched block includes that point, keep pending
3. Remove/replace board-wide fallback search that violates local connectivity intent.
4. Preserve deduction behavior for reveal cover removal (`5625` pixels rule).

## Verification

1. Repro where threshold is crossed and confirm reveal does not occur until next touch.
2. Confirm reveal anchor corresponds to the current scratch touch locality.
3. Force local area saturation around the touch and confirm reveal stays deferred instead of jumping across board.
4. Confirm completion state still resolves once pending reveals are consumed and budget is exhausted.

## Risk Notes

- Proximity-only defer can stall if reveal windows become impossible; logic must avoid deadlock.
