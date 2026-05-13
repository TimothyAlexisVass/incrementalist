# Specification: Slop Repair Phase 4 - Progress Bar Migration

## 1. Objective
Refactor the Progress Bar to use direct WebGL rendering, removing the offscreen canvas "bridge" and implementing the liquid effect as a native fragment shader.

## 2. Identified Violations
- **File:** `assets/src/features/progress-bar/render.ts`
- **Violation:** `progressSurface` (Line 124) creates a full-resolution offscreen canvas.
- **Critical Failure:** The entire 1280x760 buffer is uploaded to the GPU every frame, which is extremely slow and forbidden.

## 3. Implementation Steps

### 3.1 Liquid Shader
1.  **Implement `LIQUID_SURFACE` Shader**:
    - Port the JavaScript wave math (`Math.sin`, time-based offsets) to a GLSL fragment shader.
    - Input: `u_time`, `u_progress`, `u_fillColor`.
    - Output: A procedurally generated liquid surface with transparency.

### 3.2 Progress Bar Refactor
1.  **Direct Drawing**:
    - Use `renderer.drawRect` for the background track.
    - Use `renderer.drawRect` for the solid fill portion.
    - Use a single quad with the `LIQUID_SURFACE` shader for the top layer of the liquid.
2.  **Removal**:
    - Delete `progressSurface`, `progressCtx`, and all logic related to blitting the offscreen canvas.

## 4. Verification
- Verify the liquid effect still moves smoothly.
- Verify progress bar fill is still a gradient color.
- Verify zero offscreen canvases are created.
