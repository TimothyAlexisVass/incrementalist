# Step 1c: Progress Bar Liquid Bubbles and Glow

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Rules
- Final state: one canvas only, `#incrementalist`.
- Do not introduce a new centralized renderer architecture.

## Task: Move Liquid Bubbles and Bar Glow onto `#incrementalist` context
- File: `assets/src/render/webgl-effects.ts`
- Move bubble and glow shaders, buffers, and data initialization.
- Update `updateGpuProgressLiquidBubbles` and `setGpuProgressBarGlow` to operate on the main context.
- Ensure the clipping rect for bubbles is correctly calculated in the new coordinate space.

## Mandatory checks
- `tsc --noEmit`
- `npm run build`
- Manual verification: Bubbles appear inside the bar and the glow surrounds it without visual artifacts.
