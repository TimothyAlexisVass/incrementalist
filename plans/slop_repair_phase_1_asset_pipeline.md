# Specification: Slop Repair Phase 1 - Asset Pipeline

## 1. Objective
Remove all `Canvas2D` usage from the asset pipeline, specifically in `currency-icons.ts`, and replace manual CPU-side downsampling with native WebGL mipmapping.

## 2. Identified Violations
- **File:** `assets/src/render/currency-icons.ts`
- **Violation:** `document.createElement('canvas')` (Line 163) and `getContext('2d')` (Line 166).
- **Behavior:** The current code manually downsamples images in loops to achieve high-quality scaling, creating multiple temporary canvases.

## 3. Implementation Steps

### 3.1 WebGLRenderer Enhancements
1.  **Update `getOrCreateImageTexture`**:
    - Add a check for whether the image is a power-of-two (POT).
    - If POT, call `gl.generateMipmap(gl.TEXTURE_2D)`.
    - Set `gl.TEXTURE_MIN_FILTER` to `gl.LINEAR_MIPMAP_LINEAR`.
    - For NPOT images, use `gl.LINEAR` (WebGL 1.0 limitation) or ensure assets are POT.

### 3.2 Currency Icons Refactor
1.  **Remove `getSmoothedCurrencyIconCanvas`**: Delete the function and the `smoothedCurrencyIconCanvases` cache.
2.  **Remove `downsampleImage` & `createSmoothedCanvas`**: Delete these functions entirely.
3.  **Simplify `drawCurrencyIcon`**: 
    - Pass the original `HTMLImageElement` directly to `renderer.drawImage`.
    - Let the GPU handle the scaling via the improved texture loading in `WebGLRenderer`.

## 4. Verification
- Search `assets/src/render/currency-icons.ts` for `canvas`.
- Verify icons appear smooth at small sizes in the browser.
