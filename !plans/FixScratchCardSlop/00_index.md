# Scratch Card Remediation Plan Index

## Problem Inventory

1. Scratch visuals behave like opaque paint-over instead of cover removal/mask reveal.
2. Reveal placement and timing do not honor threshold-crossing context and local-proximity defer behavior.
3. Scratching stops when pointer input lifts, instead of continuing to completion once the run has started.
4. UI copy leaks internal mechanics to players.
5. HUD exposes internal counters and premature terminal status text.
6. Multi-reveal reward outcomes are summarized as a single best-tier payout presentation.
7. Fast drag motion produces discontinuous scratches due to frame-gap stamping.

## This Remediation Batch (In Scope)

1. `01_visual_mask_semantics_and_reveal_visibility.md`
2. `02_threshold_anchor_and_proximity_defer.md`
3. `03_autocontinue_scratch_until_budget_spent.md`
4. `04_ui_copy_and_hud_redaction.md`
5. `05_stroke_interpolation_for_fast_drag.md`

## Out of Scope for This Batch

- Problem 6 is intentionally excluded from this remediation batch.
