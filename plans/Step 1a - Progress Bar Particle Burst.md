# Step 1a: Progress Bar Particle Burst

## CRITICAL!!!!
- Offscreen workaround rendering is forbidden: do not introduce temporary offscreen canvas/surface composition paths as a migration shortcut!!!!

## Rules
- Final state: one canvas only, `#incrementalist`.
- Do not introduce a new centralized renderer architecture.
- When the particles are drawn onto the `#incrementalist` canvas, that must happen with the WebGL equivalent of `mix-blend-mode: screen`.
- Specifically: `gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)` (Add-blend style).

## Task: Move Progress Bar Particle Burst onto `#incrementalist` context
- File: `assets/src/render/webgl-effects.ts`
- Move particle shader, buffer, and data initialization to use the main WebGL context from `assets/src/renderer/webgl.ts`.
- Update `spawnGpuProgressCompletionBurst` and `renderWebGLEffects` (particle section) to target the main canvas.
- Remove separate `#effects-canvas` dependencies for this effect.

## Mandatory checks
- `tsc --noEmit`
- `npm run build`
- Manual verification: Progress bar completion burst is visible and blends correctly on the main canvas.
