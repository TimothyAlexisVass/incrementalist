# Step 13: Locked Items Review Plan

This step governs locked visual overlays, transparency alphas, rectangular/circular pointer bounds, and milestone requirement hovers.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Central locked Renderer (`drawLockedElement`)**: Shared canvas component inside `assets/src/ui/components/locked-element.ts` which locks specific elements (IDLE Toggle, Sisu Ball Generator, Shop items) before they are purchased.
- **Lock Transparencies (`withLockedAlpha`)**: Binds drawing inside alpha gates to dim underlying UI elements, making locked components feel premium and non-interactive:
  - Opacity levels are custom (e.g. `0.7` for locked items, `0.25` for owned ones).
- **Milestone Hovers & Requirements**:
  - Displays centered `'LOCKED'` or custom milestone labels over the card.
  - Hover Pointer Test: Binds input listeners (`input.pointer`) to hit-test pointer positions against element boundaries:
    - Rectangular hits: `pointInRect(input.pointer, hitRect)`.
    - Circular hits: checks radial distance: `dx * dx + dy * dy <= radius * radius` (specifically used for the Sisu Ball control locks).
  - Hover Tooltip: If pointer hovers, triggers `queueTooltip(pointer, criteria)` displaying unlock requirements dynamically.
- **Lock Notice Markers**: Displays green dot notification markers directly adjacent to the locked text labels.

---

## Step-by-Step Execution Verification Plan

### 1. Alpha Transparency Dimming
- **Verify**: Audit locked elements:
  - The Sisu control is locked at Level 1. Underlying rings are drawn under dimmed alpha gates.
  - Locked shop cards draw using `opacity = 0.7`.
- **Verify**: Confirm that underlying elements remain visible but clearly locked.

### 2. Rectangular and Circular Pointer Bounds
- **Verify**: Hover over the Sisu Ball control (circular element).
- **Verify**: The tooltip must **only** trigger when the pointer is inside the radial boundary of the circle, proving the circular hit test formula is running correctly.
- **Verify**: Hover over a locked shop card or toggle. Bounding hit tests must adapt to rectangular box sizes, with custom bounds offsets matching padding parameters.

### 3. Unlock Requirement Tooltips
- **Verify**: Hover pointer over a locked item.
- **Verify**: A clean, readable floating tooltip pops up instantly detailing the unlock milestones (e.g. `"Requires Level 25"`).
- **Verify**: Move pointer away. Tooltip vanishes instantly without trailing frames.

### 4. Notice Pings
- **Verify**: Unread locked features display green dot notification indicators.
- **Verify**: The notice markers adjust positions dynamically alongside label text measurements (using `measureTextWidth`).
