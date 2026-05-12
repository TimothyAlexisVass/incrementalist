# Specification: Slop Repair Phase 3 - SDF Text System (Troika)

## 1. Objective
Eliminate the expensive and forbidden "Canvas-per-String" text rendering model. Replace it with a professional, production-ready SDF text system using `troika-three-text` and `Three.js`. This provides high-quality text with native support for outlines, shadows, and smooth scaling without any `Canvas2D` or `OffscreenCanvas` dependencies during runtime.

## 2. Identified Violations
- **File:** `assets/src/renderer/webgl.ts`
- **Violation:** `textMeasureCanvas` (Line 177) and `textCanvas` (Line 447).
- **Critical Failure:** Creating a new DOM element and canvas context for every unique string is non-performant and violates the target platform restrictions.

## 3. Technology Stack
- **Three.js**: Used as the foundational 3D/2D rendering engine.
- **troika-three-text**: A powerful SDF text rendering library for Three.js.
- **SDF (Signed Distance Fields)**: Allows for infinitely scalable text with sharp edges and efficient effects (outlines, blur).
- **Web Workers**: Troika offloads glyph generation and layout to a worker thread.

## 4. Implementation Steps

### 4.1 Dependency Installation
```bash
npm install three troika-three-text
```

### 4.2 Three.js Integration
1.  **Initialize Three.js Context**: Update `assets/src/renderer/webgl.ts` to include a `THREE.WebGLRenderer` that wraps the existing `#incrementalist` canvas.
2.  **Shared Context**: Ensure the existing custom WebGL logic and Three.js can co-exist if needed, though ideally, we should move towards a unified Three.js scene.
3.  **Orthographic Camera**: Setup a 1:1 orthographic camera to match the 2D coordinate system (1280x760).

### 4.3 Troika Text Engine
1.  **Text Manager**: Create a service or update `WebGLRenderer` to manage `Text` meshes from `troika-three-text`.
2.  **Font Loading**: Use the newly added fonts:
    - `/fonts/Inter-Regular.woff`
    - `/fonts/Inter-Bold.woff`
3.  **`drawText` Implementation**:
    - Instead of `Canvas2D` sprites, instantiate or reuse `troika-three-text` `Text` objects.
    - Map `DrawTextOptions` to Troika properties:
        - `color` -> `color`
        - `strokeColor`/`strokeWidth` -> `outlineColor`/`outlineWidth`
        - `shadow` -> implemented via Troika's outline system (using `outlineWidth: 0` for pure shadow).
    - Call `text.sync()` to trigger SDF generation.

### 4.4 Advanced Effects Mapping
- **Outline**: `outlineWidth`, `outlineColor`.
- **Shadow**: 
  ```javascript
  text.outlineWidth = 0;
  text.outlineColor = shadowColor;
  text.outlineOffsetX = shadowOffsetX;
  text.outlineOffsetY = shadowOffsetY;
  text.outlineBlur = shadowBlur;
  text.outlineOpacity = shadowOpacity;
  ```

### 4.5 Cleanup
- Remove `textMeasureCanvas`, `textMeasureCtx`, and `textCache` from `WebGLRenderer`.
- Remove `createTextSprite` and `getOrCreateTextSprite`.
- Eliminate all `document.createElement('canvas')` hits in the renderer.

## 5. Verification
- Verify all text (HUD, Progress Bar, Sisu) renders correctly using the Inter font.
- Verify that resizing the window/canvas maintains text sharpness.
- Verify **ZERO** hits for `document.createElement('canvas')` in `assets/src/renderer/webgl.ts`.
- Verify performance stability with many text elements.
