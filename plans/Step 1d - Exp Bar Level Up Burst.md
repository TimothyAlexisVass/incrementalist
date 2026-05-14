# Step 1d: Exp Bar Level Up Burst

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Rules
- Final state: one canvas only, `#incrementalist`.
- Do not introduce a new centralized renderer architecture.

## Task: Fully integrate Exp Bar Burst with GPU Particle System
- File: `assets/src/ui/layout/top-hud/render.ts`
- File: `assets/src/render/webgl-effects.ts`
- Remove the 2D canvas fallback particles in `renderTopHUD`.
- Ensure `spawnGpuProgressCompletionBurst` is called correctly for the top HUD exp bar.
- Update the main renderer to handle these particles on the `#incrementalist` canvas.

## Mandatory checks
- `tsc --noEmit`
- `npm run build`
- Manual verification: Leveling up triggers a GPU-accelerated burst on the top HUD.
