# Plan: Stroke Interpolation for Fast Drag

## Goal

Make scratch strokes continuous during fast drags so motion does not leave artificial gaps.

## Scope

- `assets/src/features/bonustime/12-scratch-card/interactions.ts`
- scratch-card tests in `assets/src/tests/bonustime-flow.test.ts` (or equivalent)

## Implementation Plan

1. Track previous logical brush point while pressed.
2. On each pressed frame, if point moved:
   - sample intermediate points along the segment at fixed spacing tied to brush size
   - apply scratch touch on each sampled point in order
3. Keep single-point behavior when movement is tiny.
4. Clear previous-point tracking cleanly on release or reset.

## Verification

1. Perform high-speed drag across board.
2. Confirm there are no obvious untouched gaps between successive frame samples.
3. Confirm threshold/reveal progression remains stable with interpolation enabled.

## Risk Notes

- Too-dense interpolation can inflate work per frame.
- Spacing must balance continuity and performance.
