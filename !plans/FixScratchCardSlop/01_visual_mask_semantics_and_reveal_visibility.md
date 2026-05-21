# Plan: Scratch Surface Must Mask, Not Paint Over

## Objective

Render the scratch card as layered art:

- `priv/static/images/scratch_background.png` is the board base.
- `priv/static/images/scratch_surface.png` is the top cover.
- As the player scratches, the cover becomes fully transparent in the scratched regions so the background and rewards show through immediately.

Do not fake scratches with opaque hole paint.

## File In Scope

- `assets/src/features/bonustime/12-scratch-card/render.ts`

## Current Problem (What Is Wrong)

1. `drawScratchSurface(...)` draws the cover as solid geometry and then paints opaque dark rectangles into scratched cells.
2. The render order is still based on that workaround instead of a true transparent surface layer.
3. The result looks like paint-on holes instead of removed surface material.

## Required End State

1. The board is rendered from `scratch_background.png` and the cover from `scratch_surface.png`.
2. Scratched regions of `scratch_surface.png` are fully transparent.
3. `scratch_background.png` and reward visuals remain visible underneath the transparent regions.
4. No opaque per-scratched-cell rectangle painting remains.

## Exact Implementation Steps

1. Edit `renderScratchCard(...)` call order in `render.ts`:
   - draw `scratch_background.png` first
   - draw `drawRevealVisuals(...)` and reward art beneath the scratch surface
   - draw `scratch_surface.png` last as the top cover layer
   - keep `drawParticles(...)` and `drawBrushPreview(...)` above the cover if needed
2. Edit `drawScratchSurface(...)` in `render.ts`:
   - remove opaque scratched-cell painting logic
   - render the scratch surface image instead of solid brown geometry
   - apply the existing scratched mask so scratched regions are fully transparent
3. Keep the background and cover roles separate:
   - `scratch_background.png` is the underlying board art
   - `scratch_surface.png` is the removable top layer
   - the cover must never be used as a fake background fill
4. Do not modify game logic, thresholds, interactions, or backend behavior in this plan.

## Acceptance Criteria

1. After scratching, the cover looks cut away instead of painted over with dark blocks.
2. Reward visuals are visible through scratched regions immediately.
3. No reward tile is hidden behind an opaque scratch overlay after reveal.
4. No offscreen canvas/surface path is introduced; rendering remains direct to `#incrementalist`.

## Verification Procedure

1. Enter scratch card and begin scratching near center.
2. Confirm the scratched trail looks like transparency cut out of the cover art.
3. Reach first reveal threshold and trigger reveal.
4. Confirm the reveal is visible through the scratched opening and is not obscured by the surface.
5. Continue scratching and confirm all further reveals stay visible.

## Non-Goals

1. Do not change reward payout modal behavior.
2. Do not change threshold/defer logic in interactions.
3. Do not change auto-continue behavior.
