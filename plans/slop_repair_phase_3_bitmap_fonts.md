# Specification: Slop Repair Phase 3 - Bitmap Font System

## 1. Objective
Eliminate the expensive and forbidden "Canvas-per-String" text rendering model. Replace it with a native WebGL Bitmap Font system that uses a single texture atlas for all glyphs.

## 2. Identified Violations
- **File:** `assets/src/renderer/webgl.ts`
- **Violation:** `textMeasureCanvas` (Line 177) and `textCanvas` (Line 447).
- **Critical Failure:** Creating a new DOM element and canvas context for every unique string is non-performant and violates the target platform restrictions.

## 3. Implementation Steps

### 3.1 Asset Preparation
1.  Generate/Provide a Bitmap Font texture atlas (e.g., `font.png`) and a metrics file (e.g., `font.fnt` or JSON).
2.  Include standard characters (ASCII + common symbols).

### 3.2 Renderer Refactor
1.  **Loader**: Implement a loader that parses the font metrics and uploads the atlas to a single persistent WebGL texture.
2.  **`drawText` Rewrite**:
    - Instead of drawing to a canvas, iterate over characters in the string.
    - For each character, look up UV coordinates and dimensions from the metrics.
    - Generate vertices for each glyph (quads).
    - Draw using a single call (or batched calls) referencing the font atlas.
3.  **Removal**:
    - Delete `textMeasureCanvas`, `textMeasureCtx`, and `textCache`.
    - Delete `createTextSprite` and `getOrCreateTextSprite`.

## 4. Verification
- Verify all text in the game renders correctly.
- Verify NO `document.createElement('canvas')` calls occur during text rendering.
- Verify performance improvement in profiling.
