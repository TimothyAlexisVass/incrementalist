## Stable Text Refactor: Centralize Stable Text

### Goal
Eliminate scattered `resolveUpdatingText(...)` calls by making stable text a renderer-level feature that activates whenever a text key is present.

### Core Idea
If a text slot has a key, it should stabilize.
If there is no key, it should render normally.

That makes stability an identity concern, not a separate boolean sprinkled through the codebase.

### Why
Right now the same pattern is repeated in many places:
- build the candidate string,
- call `resolveUpdatingText(...)`,
- pass a readiness callback using `renderer.isTextReady(...)`,
- then draw the returned string.

This is correct, but repetitive. It is also easy to forget in a new feature, which is how the bug in the plant tooltip happened.

### Existing State
The project already has:
- a shared state machine in `assets/src/utils/text.ts`,
- renderer readiness checks in `assets/src/renderer/webgl.ts`,
- and a partial centralization for tooltips in `assets/src/ui/components/tooltip.ts`.

Current scattered call sites include:
- top HUD counters,
- season HUD labels,
- bonus time countdown text,
- Sage reveal text,
- orchard soil stats,
- orchard plant modal text,
- quest/fame text,
- several tooltip entry points.

### Proposed API Direction
Prefer a keyed text option rather than a separate `stabilize` boolean.

Recommended model:
- `textUpdateKey` present => stabilize,
- `textUpdateKey` absent => draw raw text.

That keeps the behavior easy to remember and prevents duplicated control flags.

### Important Constraint
A key-only switch is not enough by itself if the caller needs the stabilized string before measuring layout.

So the centralized design should support both:
- immediate stabilized text for direct draw calls,
- and stabilized text returned before layout measurement when a caller needs width/line math first.

### Implementation Plan
1. Promote stable-text handling into a shared helper close to the renderer or tooltip plumbing.
2. Make the helper accept a text key plus render style metadata.
3. Have the helper return the stable string and/or draw directly, depending on the call path.
4. Treat key presence as the only opt-in for stabilization.
5. Keep multi-line readiness checks in the shared helper so callers do not reimplement them.
6. Preserve cleanup support for ephemeral scopes like Sage tip text prefixes.
7. Convert current call sites one feature at a time after the shared path exists.

### What Should Stay Separate
- Special multi-line tooltip/table rendering logic.
- Feature-specific text generation.
- Scope cleanup for ephemeral UI regions.

### Risks
- A too-minimal abstraction could only move the repetition around instead of removing it.
- A too-general abstraction could become hard to reason about for multi-line or measured text.
- Tooltips and measured HUD text may need slightly different helper shapes, even if they share the same stable-text core.

### Acceptance Criteria
- New stable text does not require manual `resolveUpdatingText(...)` wiring in each feature.
- A text key alone is enough to opt into stabilization.
- Tooltip and HUD code paths can reuse the same shared mechanism.
- Existing behavior stays visually stable, including multi-line text and staged reveal text.
