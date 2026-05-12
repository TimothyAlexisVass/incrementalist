# Specification: WebGL Migration & Slop Remediation

## 1. Executive Summary
This document outlines the required remediation for the failed WebGL migration. While a migration to a single WebGL canvas (`#incrementalist`) was planned, the initial execution introduced multiple "offscreen workaround" patterns. These workarounds involve creating hidden `Canvas2D` surfaces and blitting them to the WebGL context. 

**This pattern is strictly forbidden.** The target platform for this application does not support `document.createElement('canvas')`, `OffscreenCanvas`, or `getContext('2d')`. All rendering must occur directly on the primary WebGL context via the centralized `WebGLRenderer`. The current implementation contains significant AI slop where Canvas2D is used as a bridge, which must be replaced with native WebGL logic to meet platform requirements.

## 2. Identified Violations (The "Slop")

### 2.1 Progress Bar (Pseudo-Migration)
**Location:** `assets/src/features/progress-bar/render.ts`
The progress bar implementation currently creates a full-resolution offscreen canvas (`progressSurface`) to reuse existing `Canvas2D` drawing logic (gradients, liquid paths, clipping).
- **Violation:** `document.createElement('canvas')` (Line 951) and `getContext('2d')` (Line 956).
- **Critical Failure:** Every frame, the entire 1280x760 offscreen buffer is uploaded as a texture to the GPU (Line 130). This is extremely inefficient and violates the prohibition on offscreen buffers.

### 2.2 Sisu Generator (Hybrid Rendering Slop)
**Location:** `assets/src/features/sisu/render.ts`
The Sisu implementation uses a similar "bridge" pattern, creating a forbidden `sisuSurface` canvas.
- **Violation:** `document.createElement("canvas")` (Line 331) and acquire context (Line 336).
- **Architectural Mess:** It draws the circular meter and the modal to the offscreen canvas, then blits that canvas to WebGL (Line 57, Line 299). It simultaneously attempts direct WebGL calls for buttons, creating a fragile and non-performant hybrid rendering model.

### 2.3 Currency Icons (CPU Smoothing)
**Location:** `assets/src/render/currency-icons.ts`
Uses offscreen canvases to downsample images in JavaScript before uploading them to WebGL.
- **Violation:** `document.createElement('canvas')` (Line 163).
- **Remediation:** Smoothing must be handled by WebGL mipmapping or pre-scaled assets.

### 2.4 Foundational Renderer (Canvas-Based Text)
**Location:** `assets/src/renderer/webgl.ts`
The core WebGL renderer currently uses a 2D canvas for text measurement and creates a unique offscreen canvas/texture for every unique string.
- **Violation:** `textMeasureCanvas` (Line 177) and `textCanvas` (Line 447).
- **Remediation:** A true WebGL text system (Bitmap Font or MSDF) must be implemented.

---

## 3. Remediation Strategy (Ordered by Difficulty)

The remediation is split into 5 phases, starting with the simplest asset corrections and moving towards complex UI migrations.

### [Phase 1: Asset Pipeline](file:///Users/timothy/incrementalist/plans/slop_repair_phase_1_asset_pipeline.md)
**Difficulty: Very Easy**
- Remove CPU-side image downsampling.
- Enable native WebGL mipmapping for smooth icons.

### [Phase 2: Procedural Shape Shaders](file:///Users/timothy/incrementalist/plans/slop_repair_phase_2_procedural_shapes.md)
**Difficulty: Easy/Medium**
- Implement SDF-based shaders for rings, arcs, and circles.
- Provides the foundation for UI meters.

### [Phase 3: Bitmap Font System](file:///Users/timothy/incrementalist/plans/slop_repair_phase_3_bitmap_fonts.md)
**Difficulty: Hard (Infrastructure)**
- Replace the forbidden "Canvas-per-String" text system with a native Bitmap Font atlas.
- Essential pre-requisite for all remaining UI features.

### [Phase 4: Progress Bar Migration](file:///Users/timothy/incrementalist/plans/slop_repair_phase_4_progress_bar.md)
**Difficulty: Hard (Feature Migration)**
- Port the liquid effect to a GLSL shader.
- Eliminate the massive offscreen buffer upload.

### [Phase 5: Sisu HUD Control](file:///Users/timothy/incrementalist/plans/slop_repair_phase_5_sisu_hud.md)
**Difficulty: Medium**
- Port the circular meter and HUD text to direct WebGL.
- Use the new SDF arc shaders for perfect rendering.

### [Phase 6: Sisu Generator Modal](file:///Users/timothy/incrementalist/plans/slop_repair_phase_6_sisu_modal.md)
**Difficulty: Hardest**
- Complete migration of the complex modal panel, refill controls, and layout.
- Final cleanup of all `OffscreenCanvas` residue.

---

## 4. Compliance Verification
The remediation is considered complete only when a recursive search of `assets/src` for the following terms returns **ZERO** hits:
- `document.createElement('canvas')`
- `getContext('2d')`
- `OffscreenCanvas`
- `ImageBitmap` (if created via canvas)

**Rule of Thumb:** If it's not a direct call to the WebGL context or the `WebGLRenderer` abstraction, it is a violation.
