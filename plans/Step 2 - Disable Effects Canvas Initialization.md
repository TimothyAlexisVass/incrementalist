# Step 2: Disable Effects Canvas Initialization

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Task: Stop initializing `#effects-canvas`
- File: `assets/src/app.ts`
- Stop initializing `#effects-canvas`.
- Ensure all references to the effects canvas context are redirected to `#incrementalist` or removed if redundant.

## Mandatory checks
- `tsc --noEmit`
- `npm run build`
- Manual verification:
  - Game still boots correctly.
  - No errors in console regarding missing canvas.
