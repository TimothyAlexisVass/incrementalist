## Stable Text Refactor: Tooltips

### Goal
Make gameplay tooltips use a fixed-width, two-column layout where labels sit on the left and values sit on the right, instead of building ad hoc freeform strings in each feature.

### Why
The current tooltip approach spreads text shaping, width guessing, and stabilization logic across many feature modules. A fixed-width table-style tooltip:
- removes most width measurement guesswork,
- makes alignment consistent,
- reduces per-feature custom rendering code,
- and matches the orchard soil stats tooltip pattern the team already likes.

### Design
Use a shared tooltip layout model:
- fixed tooltip width,
- left column for labels,
- right column for values,
- optional row colors/fonts,
- optional section headers or separators,
- optional single-line description blocks when a table layout is not a good fit.

The tooltip renderer should accept structured rows instead of only raw strings for stat-like content. Example shape:
```ts
[
  { label: "Nitrogen", value: "12.5" },
  { label: "Water", value: "84 / 120" }
]
```

### Scope
Best candidates for the table layout:
- orchard soil stats,
- plant hover stats,
- Sisu values,
- progress/status readouts,
- other stat-heavy hover tooltips.

Likely non-candidates:
- short instructional tooltips,
- one-line hints,
- special narrative text,
- button hover labels that are not data tables.

### Implementation Plan
1. Define a shared tooltip row structure in the tooltip component or a nearby helper.
2. Render rows with a fixed width and consistent column placement.
3. Keep label/value alignment and width reservation stable across frames.
4. Preserve optional per-line color/font customization.
5. Allow plain-string tooltips to continue working for non-table cases.
6. Migrate orchard soil stats first as the canonical example.
7. Convert other stat-like tooltips once the shared layout is stable.

### Centralization Benefits
- Less repeated `drawText` positioning code.
- Less repeated string concatenation in feature modules.
- Fewer places needing text stabilization logic.
- Easier visual consistency across the UI.

### Risks
- Forcing everything into the table shape would make some tooltips worse, not better.
- Some existing tooltip call sites may need a mixed mode: table rows plus a short descriptive footer.
- The renderer needs to keep working with both fixed-width and freeform tooltip content during the transition.

### Acceptance Criteria
- Orchard soil stats style becomes the default pattern for stat tooltips.
- Tooltip width is fixed for table-style tooltips.
- Labels and values align consistently across features.
- Plain string tooltips still render unchanged where appropriate.

