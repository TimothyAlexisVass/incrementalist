# Step 1e: Click Burst Particles

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Rules
- Final state: one canvas only, `#incrementalist`.
- Do not introduce a new centralized renderer architecture.

## Task: Move Click Burst onto `#incrementalist` context
- File: `assets/src/render/webgl-effects.ts`
- Move `spawnGpuClickBurst` to use the main WebGL context.
- Ensure click particles blend correctly with the area background and UI.

## Mandatory checks
- `tsc --noEmit`
- `npm run build`
- Manual verification: Clicking triggers a particle burst on the main canvas.
