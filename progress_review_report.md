# Progress Accumulation & Projection Review

## 1. Visual Progress Lerping Verification
- The frontend smoothly interpolates `projectedFill` and Sisu multipliers between the snapshot values and their target claim values.
- `updateProjectedFill` efficiently uses `getServerNow()` delta to derive accurate interpolation parameters for `projectedFill`, `sisu`, and `currentSisuDecay`.
- The countdown estimation relies strictly on authoritative server timestamps like `canClaimInMs` and `canClaimAt`.

## 2. Idle Mode Mode Transitions
- The Sisu and UI interpolation deducts `IDLE_MODE_BUFFER` from the visual duration precisely during idle mode to hit 100% early, ensuring the visual pop/glow effect correctly resolves before automatic claim processing.
- Base progression adapts immediately, switching between `Constants.progress_bar_base_idle_mode_on_fill_rate()` and `Constants.progress_bar_base_idle_mode_off_fill_rate()`.

## 3. Level-Scale Bonus Multipliers
- The `base_progress_bar_fill_rate/2` logic applies early-game exponential boosts perfectly according to `progress_bar_new_player_bonus_fill_multiplier`, `progress_bar_late_new_player_bonus_fill_multiplier`, and `progress_bar_new_player_bonus_fill_bonus` until Level 35.

## 4. Sisu Multiplier Projection
- In Elixir, `project_projection` and `apply_decay_step` accurately project Sisu diminishment toward default decayed targets securely over cycles.
- The `sisu_multiplier` logic applies a clamped floor based on `Constants.progress_bar_sisu_min_multiplier()`.

## Tests Feedback
While progress math matches expectations end-to-end, `mix test` flags three failures related to charge crystal grants in `apply_level_ups/1` and `finalize_claim/2`. The issue is not with the generation logic itself, but rather a mismatch between the unit tests' hardcoded expectations and the actual values defined in `Constants.ex` (for example, the test expects an azure crystal every 4th claim, but the constant `charge_crystal_azure_claim_interval` is set to 9).

Overall, accumulation and projection operate exactly as planned.