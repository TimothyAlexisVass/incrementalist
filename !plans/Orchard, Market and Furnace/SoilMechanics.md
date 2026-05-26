# Soil Mechanics Implementation Plan

## Scope
Implement Phase 4 soil mechanics for the Orchard with server-authoritative hourly updates driven by climate.

This plan covers:
- Global orchard soil stats: `water_level`, `nitrogen`, `phosphorus`, `potassium`, `organic_matter`
- Organic-matter-based water retention and runoff
- Nutrient leaching tied to effective water loss
- Decomposition hard-stop when organic matter is at max

This plan does not cover:
- Per-plot depth mechanics
- Plant growth/harvest modifiers from soil stats
- Composting research systems

## Shared Requirements Source
Canonical shared orchard configuration lives in:
- `shared/requirements/orchard.json`

All shared orchard defaults/limits/rates in this plan should be defined there and loaded via `lib/incrementalist/game/constants.ex` (same pattern as other requirement files).

## Canonical Rules
All calculations are UTC/server-time based and processed on the server.

### Soil stat defaults
- `water_level`: integer, start `100`
- `nitrogen`: BigNum, start `5`
- `phosphorus`: BigNum, start `5`
- `potassium`: BigNum, start `5`
- `organic_matter`: BigNum, start `20`

### Organic matter bounds
- `organic_matter` min: `0`
- `organic_matter` max: `2000`

### Organic matter linear effects
Let:
- `om = clamp(organic_matter, 0, 2000)`
- `om_ratio = om / 2000`

Then:
- `runoff_rate = 1.0 - (0.5 * om_ratio)`  
  - At `om=0` => `runoff_rate=1.0` (100%)
  - At `om=2000` => `runoff_rate=0.5` (50%)
- `water_cap = 150 + (100 * om_ratio)`  
  - At `om=0` => cap `150`
  - At `om=2000` => cap `250`

### Runoff application rule
`runoff_rate` applies to all water-loss paths:
- Hourly dry-down (when not raining)
- Overflow shedding/leaching (when water exceeds cap)
- Any rain-driven excess that cannot be retained

### Decomposition cap rule
If `organic_matter >= 2000`, player cannot choose "leave plant matter to decompose".

## Soil Projection Algorithm (Hourly)
Use server-hour boundaries only.

1. Resolve elapsed whole climate hours since `soil.projected_at`.
2. For each elapsed hour in order:
   - Pull authoritative climate hour (`rain_mm`, `rain_intensity`).
   - Recompute `runoff_rate` and `water_cap` from current `organic_matter`.
   - Apply hourly water delta:
     - If no rain: apply dry-down loss scaled by `runoff_rate`.
     - If rain: apply rainfall gain, then compute overflow above `water_cap`.
   - Compute `effective_water_loss` for this hour:
     - Includes dry-down loss.
     - Includes overflow shedding.
     - Includes rain-driven excess above cap.
   - Apply nutrient leaching from `effective_water_loss`:
     - `N`, `P`, `K`, `organic_matter` all reduced proportionally.
     - `P` leaches at half the N/K rate (per Masterplan).
   - Clamp values:
     - `water_level >= 0`
     - `water_level <= water_cap`
     - `N/P/K/organic_matter >= 0`
     - `organic_matter <= 2000`
3. Store updated `soil.projected_at` at the last applied server hour boundary.

## Constants and Tuning
Add orchard fields to `shared/requirements/orchard.json` and expose them via server-owned accessors in `lib/incrementalist/game/constants.ex`:
- Soil defaults
- Organic matter max
- Base dry-down rate
- Rain-to-water gain scale
- Nutrient leach coefficients (N/K baseline, P half-rate multiplier, organic-matter leach multiplier)

No inline gameplay magic numbers in feature modules.

## Server Data Model
Add embedded schema on `State`:
- `soil` embed with:
  - `water_level` (integer)
  - `nitrogen` (BigNum)
  - `phosphorus` (BigNum)
  - `potassium` (BigNum)
  - `organic_matter` (BigNum)
  - `projected_at` (ISO8601 UTC string)

Initialize defaults in `State.new/1`.
Expose visible payload in `State.visible_state/2`.

## Server Integration Points
1. Add `Incrementalist.Game.Features.Orchard.Soil` rules module.
2. Project soil in the same authoritative state-projection path used for other time-based systems.
3. Ensure command results continue to include refreshed climate; soil projection uses same server `now`.

## Protocol / Snapshot Surface
Extend `game.snapshot.state` with:
- `soil` object with authoritative values only.

Use centralized client merge (`applyAuthoritativeData`) for updates; no ad-hoc client-side mutation logic.

## Orchard UI / UX Plan
1. Add orchard soil details panel:
   - Water Level (integer)
   - N, P, K, Organic Matter (BigNum formatted)
   - Dynamic labels:
     - Current runoff %
     - Current water cap
2. In plant matter action UI:
   - Disable "leave to decompose" when `organic_matter >= 2000`
   - Show explicit reason text

No extra canvases, no offscreen render paths.

## Testing Plan
Backend tests:
- Soil default initialization.
- Linear interpolation correctness at `om=0`, `1000`, `2000`.
- Runoff applied to dry-down, overflow, and rain-driven excess.
- Nutrient leach proportionality with P half-rate.
- Cap behavior and clamps.
- Decomposition blocked at `organic_matter=2000`.
- Multi-hour projection determinism from fixed `now` and fixed climate hours.

Frontend tests:
- Protocol typing and snapshot merge for `soil`.
- Orchard soil panel rendering with BigNum formatting.
- Decompose action disabled state and reason at OM max.

TypeScript requirement:
- Run `tsc --noEmit` after `.ts` edits.

## Implementation Sequence
1. Add `shared/requirements/orchard.json` entries and wire `Constants` accessors.
2. Add soil embed schema + defaults.
3. Add soil projection rules module with hourly stepping.
4. Wire projection into state projection flow.
5. Extend snapshot/protocol/client merge.
6. Add orchard soil UI and OM-max decomposition guard.
7. Add backend/frontend tests.
8. Run checks (`mix test` target set + `tsc --noEmit`).

## Deferred Decisions (Explicitly not assumed here)
Before coding, confirm numeric tuning values for:
- Base dry-down per hour
- Rain-to-water conversion
- N/K leach coefficient
- Organic-matter leach coefficient
