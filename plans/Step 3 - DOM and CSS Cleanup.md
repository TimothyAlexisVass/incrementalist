# Step 3: DOM and CSS Cleanup

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Task: Remove `#effects-canvas` from DOM and Styles
- Files: `priv/static/index.html`, `assets/src/app.css`
- Remove `#effects-canvas` element.
- Remove CSS rules related to `#effects-canvas`.
- Keep only `#incrementalist`.

## Mandatory checks
- `tsc --noEmit`
- `npm run build`
- Manual verification:
  - progress bar reward collection never blocks/swallow clicks
  - HUD/menu/modal/overlay behavior unchanged
  - hit testing and pointer behavior unchanged
