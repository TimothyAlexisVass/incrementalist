# Plan: Threshold Anchor and Proximity Defer Behavior

## Goal

Honor the reveal rule exactly:

- threshold crossing is determined by cumulative scratch progress
- reveal is performed on the next scratch touch
- reveal placement is anchored to the crossing cell's local proximity
- if placement is impossible locally, reveal remains deferred until a local block exists

## Scope

- `assets/src/features/bonustime/12-scratch-card/interactions.ts`
- `assets/src/tests/bonustime-flow.test.ts` (or targeted scratch-card tests)

## Implementation Plan

1. Introduce explicit pending-reveal state:
   - store scheduled reveal index/tier
   - store the crossing cell coordinates that triggered threshold eligibility
2. Change threshold detection timing:
   - determine threshold crossing after new scratch cells are deducted
   - do not reveal immediately on crossing touch
3. On the next scratch touch, resolve pending reveal:
   - search only within configured local proximity around the stored crossing cell
   - if no valid `15x15` unscratched block exists in that proximity, keep pending
4. Remove/replace board-wide fallback search that violates local proximity intent.
5. Preserve deduction behavior for reveal cover removal (`5625` pixels rule).

## Verification

1. Repro where threshold is crossed and confirm reveal does not occur until next touch.
2. Confirm reveal appears near the crossing area, not far away.
3. Force local area saturation and confirm reveal stays deferred instead of jumping across board.
4. Confirm completion state still resolves once pending reveals are consumed and budget is exhausted.

## Risk Notes

- Proximity-only defer can stall if reveal windows become impossible; logic must avoid deadlock.
