# Specification: Slop Repair Phase 2 - Procedural Shape Shaders

## 1. Objective
Enable the rendering of complex circular primitives (rings, arcs, segments) directly in WebGL using fragment shaders. This is a prerequisite for the Sisu meter and Progress Bar liquid effects.

## 2. Identified Violations
- **File:** `assets/src/features/sisu/render.ts`
- **Violation:** Uses `OffscreenCanvas` to draw circular meters.
- **File:** `assets/src/features/progress-bar/render.ts`
- **Violation:** Uses `OffscreenCanvas` for clipping and rounded paths.

## 3. Implementation Steps

### 3.1 New Shader: `SDF_PRIMITIVE`
1.  **Vertex Shader**: Simple pass-through of position and local coordinates (0 to 1).
2.  **Fragment Shader**:
    - Implement Signed Distance Field (SDF) functions for:
        - Circle (filled)
        - Ring (hollow with thickness)
        - Arc (ring segment with start/end angles)
    - Support anti-aliasing via `smoothstep`.
    - Support inner/outer gradients.

### 3.2 WebGLRenderer Methods
1.  **`drawRing(options)`**: Draw a hollow circle with specified thickness and color.
2.  **`drawArc(options)`**: Draw a segment of a ring with `startAngle` and `endAngle`.
3.  **`drawCircle(options)`**: Upgrade existing `drawCircle` to use the SDF shader for perfect anti-aliasing instead of a scaled rectangle.

## 4. Verification
- Add a temporary debug render call to draw various arcs/rings.
- Verify smooth edges without pixelation at any scale.
