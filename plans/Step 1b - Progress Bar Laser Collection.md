# Step 1b: Progress Bar Laser Collection Effect

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Rules
- Final state: one canvas only, `#incrementalist`.
- Do not introduce a new centralized renderer architecture.
- Use the WebGL equivalent of `mix-blend-mode: screen` for the laser effect.

## Task: Move Laser Collection Effect onto `#incrementalist` context
- File: `assets/src/render/webgl-effects.ts`
- Move laser shader, buffer, and data initialization to use the main WebGL context.
- Update `spawnGpuProgressCollectionLaserBurst` and `renderLaserBursts` to target the main canvas.
- Ensure laser rectangles blend correctly with the game world.

## Mandatory checks
- `tsc --noEmit`
- `npm run build`
- Manual verification: Laser collection effect triggers on claim and is visually correct.
