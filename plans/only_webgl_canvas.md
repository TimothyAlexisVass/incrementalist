# Single-Canvas Plan (`#incrementalist`) Without New Renderer Architecture

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Rules for this plan
- Final state: one canvas only, `#incrementalist`.
- Do not introduce a new centralized renderer architecture.
- Migrate rendering where it already lives (existing `render.ts` and UI render files).
- Remove old 2D draw paths as each file is migrated.
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut.
- No migration-history naming leftovers.
- Treat phase boundaries as hard gates: do not execute behavior assigned to a later phase.
- Until Phase 6, effects must continue rendering to `#effects-canvas`.
- Only the 2d canvas is to be migrated to the new webgl canvas, webgl effects remain exactly where they are.

## Migration shape
- Add `#incrementalist` as the destination canvas first.
- Keep current 2D and effects canvases temporarily only to enable incremental visible progress.
- Convert existing files one-by-one to render on `#incrementalist`.
- Delete old canvases when nothing depends on them.

## Phase 1: Add `#incrementalist` canvas layer
1. `priv/static/index.html`
- Add `<canvas id="incrementalist">` between current `#game-canvas` and `#effects-canvas`.

2. `assets/src/app.css`
- Add style/z-order for `#incrementalist`:
  - `#game-canvas` bottom
  - `#incrementalist` middle
  - `#effects-canvas` top

3. `assets/src/app.ts`
- Query `#incrementalist`.
- Initialize its GL context.
- Resize it with the same dimensions as the other canvases.

Acceptance:
- `#incrementalist` is present and clears each frame.

## Phase 2: Wire frame loop to `#incrementalist` without new renderer layer
4. `assets/src/core/game-client.ts`
- Thread `#incrementalist` context/state into existing render calls.
- Keep existing 2D draw path only for files not migrated yet.
- Do not activate `#incrementalist` as the effects output in this phase.
- Any new routing parameters must default to existing behavior (`#effects-canvas`) unless explicitly enabled in a later phase.

5. `assets/src/render/webgl-effects.ts`
- Keep current effects behavior, but ensure compatibility with eventual merge into `#incrementalist`.
- Compatibility work is prep only: no runtime switch of target canvas in this phase.

Acceptance:
- Frame loop runs with incremental routing support and no behavior regressions.
- Visual output parity with pre-Phase-2 behavior: effects still appear on `#effects-canvas`.

## Phase 3: Add a dedicated WebGL renderer
- `assets/src/renderer/webgl.ts`
- For things like drawText etc...

## Phase 4: Migrate files one by one to `#incrementalist`
For each file listed below:
- Replace current Canvas2D draw operations with direct drawing on `#incrementalist` pipeline/context.
- Keep layout/hit areas/behavior identical.
- Remove old 2D drawing path for that file in the same change.

### Shared render utilities/systems
6. `assets/src/render/effects.ts`
7. `assets/src/render/currency-icons.ts`
8. `assets/src/utils/render.ts`

### Feature render files
9. `assets/src/features/areas/render.ts`
10. `assets/src/features/areas/sage/render.ts`
11. `assets/src/features/progress-bar/render.ts`
12. `assets/src/features/sisu/render.ts`

### UI components
13. `assets/src/ui/components/bar.ts`
14. `assets/src/ui/components/button.ts`
15. `assets/src/ui/components/checkbox.ts`
16. `assets/src/ui/components/modal.ts`
17. `assets/src/ui/components/tooltip.ts`
18. `assets/src/ui/components/locked-element.ts`
19. `assets/src/ui/components/tab-menu/tab-menu.ts`
20. `assets/src/ui/components/cards/shop-item.ts`
21. `assets/src/ui/components/cards/save-slot.ts`
22. `assets/src/ui/components/modals/confirmation-modal.ts`

### UI layout + managers
23. `assets/src/ui/layout/top-hud/render.ts`
24. `assets/src/ui/layout/bottom-hud/render.ts`
25. `assets/src/ui/layout/main-menu/render.ts`
26. `assets/src/ui/managers/modals.ts`
27. `assets/src/ui/managers/overlays.ts`
28. `assets/src/ui/managers/user-interface.ts`

Acceptance per file:
- Module renders through `#incrementalist`.
- No dual render path remains for that module.

## Phase 5: Remove old 2D gameplay canvas
29. `assets/src/core/game-client.ts`
- Remove remaining `CanvasRenderingContext2D` gameplay draw dependencies.

30. `assets/src/app.ts`
- Stop creating/using 2D context for gameplay.

31. `priv/static/index.html` + `assets/src/app.css`
- Remove `#game-canvas`.

Acceptance:
- Gameplay/UI render path no longer depends on 2D canvas.

## Phase 6: Collapse effects into `#incrementalist` and end with one canvas
32. `assets/src/render/webgl-effects.ts`
- Move effects draw execution onto `#incrementalist` context.
- Remove separate effects-canvas assumptions.

33. `assets/src/app.ts`
- Stop initializing `#effects-canvas`.

34. `priv/static/index.html` + `assets/src/app.css`
- Remove `#effects-canvas`.
- Keep only `#incrementalist`.

Acceptance:
- Entire game renders on one canvas: `#incrementalist`.

## Mandatory checks after each file migration
- `tsc --noEmit`
- `npm run build`
- Manual verification:
  - progress bar reward collection never blocks/swallow clicks
  - HUD/menu/modal/overlay behavior unchanged
  - hit testing and pointer behavior unchanged

## Phase Boundary Enforcement (Required)
- Before merging a phase, confirm no code path executes behavior assigned to later phases.
- For Phase 2 specifically, reject any change that:
  - Initializes effects on `#incrementalist`.
  - Renders effects to `#incrementalist`.
  - Removes or bypasses `#effects-canvas`.

## Final notice
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!
