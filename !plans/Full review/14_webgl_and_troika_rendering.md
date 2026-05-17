# Step 14: WebGL Renderer & Troika Text Review Plan

This step governs direct WebGL shader compilations, liquid physics math on the GPU, multi-layered glow parameters, Three.js context binding, Troika vector typography caches, and text readiness verifications.

## Core Architecture & Responsibilities

### WebGL Shader Pipeline (`WebGLRenderer`)
Defined inside `assets/src/renderer/webgl.ts`. Compiles custom vertex and fragment shaders directly to run on the GPU:
- **Liquid Shader (`LIQUID_FRAGMENT_SHADER_SOURCE`)**:
  - Simulates dynamic fluid motion for the progress bar fill using double sine wave overlays: `primaryWave = sin(xRatio * 6.28318 * 0.7 + time * 0.0032)` and `secondaryWave = sin(xRatio * 6.28318 * 1.35 - time * 0.0024)`.
  - Mixes three-color vertical gradients (End $\rightarrow$ Mid $\rightarrow$ Start) and renders surface highlights on top of waves.
- **Shape Shader (`SHAPE_FRAGMENT_SHADER_SOURCE`)**:
  - Draws perfect circles, rings, and arcs with normalized softness and anti-aliasing.
  - Clips angles for arcs (`startAngle` to `endAngle`) inside the fragment program to render active Sisu multiplier meters.
- **Glow Shader (`GLOW_FRAGMENT_SHADER_SOURCE`)**:
  - Draws box-inset inner shadows and multi-layered outer glow radii around panels, active buttons, and full progress bars.
- **Single Canvas Constraint**: All drawing goes directly to `#incrementalist`. No offscreen canvases, temporary compositions, or secondary buffers are allowed.

### Three.js & Troika Text Typography
- **Context Sharing**: Instantiates a shared `three` `WebGLRenderer` using the identical active WebGL context (`gl`), rendering 3D scenes (e.g. Sisu crystals) and Troika meshes inline with standard WebGL commands.
- **Troika Text Mesh Syncing**:
  - Avoids default canvas-font pixelation by compiling crisp vector glyphs from `.woff` files (`Inter-Regular`, `Inter-Bold`, `RobotoMono-Regular`, `RobotoMono-Bold`).
  - Text geometry builds asynchronously; once complete, `mesh.sync()` sets `entry.ready = true`.
- **Text Caching Strategy**:
  - Geometry cached in `textCache` (up to `384` elements limit) to prevent redundant mesh generation.
  - Unused items are evicted after `900` frames using `TEXT_CACHE_FRAME_TTL` to protect memory.
  - **Excluding Color from Keys**: The cache keys omit material properties (colors, strokeColors) to prevent cache misses on color changes, eliminating visual frame flickering.
- **Flicker Protection (`resolveUpdatingText`)**: Text values only update when `isTextReady(...)` confirms vector glyph meshes are fully compiled.

---

## Step-by-Step Execution Verification Plan

### 1. Liquid Physics Math Verification
- **Verify**: Let the progress bar fill.
- **Verify**: Liquid surface displays wavy movement animated continuously over time.
- **Verify**: Color values transition through End, Mid, and Start palettes with surface highlights matching JS progress ratios.

### 2. Sisu Arc Meter Clipping
- **Verify**: Sisu multiplier grows.
- **Verify**: The visual meter arc expands smoothly.
- **Verify**: Angle boundaries (`startAngle` and `endAngle`) are clipped precisely inside the GPU shader without rendering overflow fragments.

### 3. Vector Font Quality & Readiness
- **Verify**: Change font scales and windows. Fonts must remain sharp (vector-based), without pixel stretching.
- **Verify**: Changing text color (e.g., gold multipliers or highlight text) must occur instantly **without a single-frame flash or disappearance**, confirming material color changes bypass geometry re-syncs.
- **Verify**: Verify that the cache size is capped at `384` items and evicts idle meshes after `900` frames.

### 4. Direct Buffer Rendering Audit
- **Verify**: Audit codebase for canvas creation.
- **Verify**: Confirm no files construct `document.createElement('canvas')` or bind offscreen canvases, keeping the single `#incrementalist` WebGL canvas as the exclusive drawing target.
