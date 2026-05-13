# Single-Canvas Plan (`#incrementalist`) Without New Renderer Architecture

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Rules for this plan
- Final state: one canvas only, `#incrementalist`.
- Do not introduce a new centralized renderer architecture.

## Migration shape
- Add `#incrementalist` as the destination canvas first.
- Delete old canvases when nothing depends on them.

## Dedicated WebGL renderer
- `assets/src/renderer/webgl.ts`
- For things like drawText etc...

## Task: Collapse effects into `#incrementalist` and end with one canvas
32. `assets/src/render/webgl-effects.ts`
- Move effects draw execution onto `#incrementalist` context.
- Remove separate effects-canvas assumptions.

CRUCIAL DETAIL!
Notice how the effects canvas currently draws with mix-blend-mode screen!
When the (current) effects drawn onto the #incrementalist canvas, that must happen with the WebGL equivalent of mix-blend-mode screen!
#effects-canvas {
  background: transparent;
  mix-blend-mode: screen;
}

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

## Final notice
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!
