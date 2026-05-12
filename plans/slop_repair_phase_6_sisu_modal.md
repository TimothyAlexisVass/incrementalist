# Specification: Slop Repair Phase 6 - Sisu Generator Modal

## 1. Objective
Port the entire Sisu Generator Modal to a native WebGL layout. This is the final and most complex phase of the slop repair.

## 2. Identified Violations
- **File:** `assets/src/features/sisu/render.ts`
- **Violation:** `SisuGeneratorModalImpl` uses a 2D canvas context for the entire modal layout.
- **Complexity:** It manages multiple nested hit regions (close button, upgrade button, refill controls) and dynamic currency formatting.

## 3. Implementation Steps

### 3.1 Modal Layout Refactor
1.  **Panel & Border**: Use `renderer.drawRect` for the main modal body and borders.
2.  **Title & Labels**: Use `renderer.drawText` for all headers and status text.
3.  **Refill Controls**: 
    - Rewrite `drawSisuRefillControl` as a native function using `drawRect`, `drawCircle` (SDF), and `drawText`.
    - Maintain the logic for `canRefill` visual states.
4.  **Buttons**:
    - Use the already-migrated `drawButton` (from `assets/src/ui/components/button.ts`) for the Close and Upgrade buttons.
    - Ensure `drawUpgradeCostLabel` uses the native renderer.

### 3.2 Hit Testing & Interaction
1.  Verify that all `Rect` definitions for hit testing (`refillRects`, `closeRect`, `upgradeRect`) are still correctly aligned with the visual rendering.
2.  Ensure `handleSisuModalInteractions` continues to work with the native layout.

### 3.3 Final Global Cleanup
1.  **Delete `sisuSurface` and `sisuSurfaceCtx`**: These should no longer be needed.
2.  **Audit**: Ensure no other hidden `document.createElement('canvas')` calls remain in the Sisu feature directory.

## 4. Verification
- Full interaction test: Open modal, refill tiers, upgrade max sisu, close modal.
- Verify zero `Canvas2D` usage in the browser profiling.
