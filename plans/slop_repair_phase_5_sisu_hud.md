# Specification: Slop Repair Phase 5 - Sisu HUD Control

## 1. Objective
Refactor the Sisu HUD Control (the circular meter on the main screen) to use direct WebGL rendering, removing the `sisuSurface` canvas bridge.

## 2. Identified Violations
- **File:** `assets/src/features/sisu/render.ts`
- **Violation:** `renderSisuControl` blits an offscreen canvas (`sisuSurface`) to WebGL every frame.
- **Architectural Mess:** It uses `Canvas2D` for the circular arcs and basic text, but attempts to use `drawLockedElement` which might be mixed.

## 3. Implementation Steps

### 3.1 Sisu HUD Layout Refactor
1.  **Arc Drawing**: Replace `ctx.arc` and `ctx.stroke` with `renderer.drawArc` (implemented in Phase 2).
2.  **Color Tiers**: Use the existing `COLORS.sisu` palette. Ensure the concentric/stacked arc logic from `getTierFillRatio` is preserved.
3.  **Text Rendering**: Use the new `renderer.drawText` (Phase 3) for the multiplier and decay labels.
4.  **Locked State**: Update `drawLockedElement` to ensure it renders natively via WebGL if it doesn't already.

### 3.2 Cleanup
1.  Remove the `sisuSurface` usage from `renderSisuControl`.
2.  Ensure `getSisuControlRect` is still accurate for hit testing.

## 4. Verification
- Verify the meter fills correctly as Sisu increases.
- Verify the colors match the design (Blue -> Yellow -> Purple).
- Verify zero offscreen canvas creation in the HUD path.
