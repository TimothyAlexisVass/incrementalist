# Step 7: Sisu Generator & Refills Review Plan

This step governs Sisu generator unlocks, shard-based maximum basic upgrades, crystal expenditures, charge validations, visual overlays, and mathematical decay cycle advancement.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Modals & Control Rect Interactions**: When clicked, if Sisu Generator is purchased, opens `createSisuGeneratorModal` (`assets/src/features/sisu/modal.ts`). If locked, navigates directly to the Sisu Shop item.
- **Visual Meter Arc & Crystals Rendering**: Draws circular tiered meters (`assets/src/features/sisu/render.ts`):
  - Azure Tier, Aether Tier, Lucent Tier, and Transcendent Tier.
  - Draws interactive WebGL gems (`renderSisuCrystal`) representing the active generator tier inside the meter.
- **Glass Ball Overlay**: Draws transparent glossy glass spheres (`renderSisuGlassBallOverlay`) using overlay circles, arcs, and additive refractive highlight overlays to create a 3D bubble effect.
- **Sisu Particles Emission**: Spawns GPU particle bursts (`releaseSisuParticles`) upon successful refills/claims.

### Server (Elixir)
- **Sisu Generator Upgrade (`Sisu.upgrade_max/2`)**:
  - Validates that the player has purchased the Sisu Generator and has sufficient shards.
  - Deducts shards synchronously, increments `max_upgrade_level`, and increases `max_basic` Sisu.
- **Crystal Refill Engine (`Sisu.refill/3`)**:
  - Restricts refills: If a charge cycle is already active (`target_current !== nil`) or target Sisu is lower than offered, returns a validation error (`sisu_charge_pending` / `sisu_already_higher`).
  - Spends charge crystals: Deducts 1 crystal from the active tier balance (`azure`, `aether`, `lucent`, or `transcendent`) via `ChargeCrystals.spend/2`.
  - Sets the `target_current` Sisu and `target_cycle_decay` rate to the selected refill tier.
- **Cycle Decays & Advancements (`Sisu.advance_cycle/2`)**:
  - During progress claims, the server shifts target Sisu and decay rates into active Sisu slots.
  - Sisu decays based on `cycle_decay` percent:
    `decayed_sisu = current_sisu * (1.0 - cycle_decay / 100.0)`.
  - Sisu is clamped to a strict minimum of `0.1`.
  - Softening decay: Softens the decay percentage for the next cycle:
    `softened_decay = cycle_decay * Constants.sisu_diminishment_reduction_factor_per_cycle()`.

---

## Step-by-Step Execution Verification Plan

### 1. Sisu Generator Modal & Upgrades
- **Verify**: Shards upgrade button accurately reflects upgrade cost formulas: `Levels.upgrade_cost(level)`.
- **Verify**: Purchasing an upgrade deducts shards and shifts the Sisu control's maximum basic Sisu label.
- **Verify**: Level upgrades are hard-capped at the authoritative maximum level.

### 2. Multi-Tier Visual Arc Meters
- **Verify**: Refilling the generator with different crystal tiers transitions the visual ring segments correctly:
  - Azure covers initial levels.
  - Aether, Lucent, and Transcendent cover high multiplier rings in additive layers.
- **Verify**: Hovering over the Sisu ball shows a precise multiplier tooltip.
- **Verify**: The glass ball 3D highlights (glare arcs, refraction shadows) render cleanly on top of the circles.

### 3. Crystal Expenditures & Validation Gating
- **Verify**: Trigger a refill. Confirm the corresponding crystal count decrements by exactly 1 on the top HUD and Sisu modal.
- **Verify**: Attempt to trigger a second refill while the current cycle is active (bar is still filling). Confirm the server returns a `sisu_charge_pending` error.
- **Verify**: Attempt to trigger a refill with a lower-tier crystal when Sisu is already high. Confirm the server returns `sisu_already_higher`.

### 4. Sisu Decay Math & Softening Cycles
- **Verify**: Claim a reward. Confirm that Sisu decays by the tier's decay percentage.
- **Verify**: Verify that the decay rate itself diminishes (softens) by the dimishment reduction multiplier (`sisu_diminishment_reduction_factor_per_cycle`) after each claim.
- **Verify**: Check that sisu never drops below its absolute lower limit of `0.1` even after extensive claims without refuels.
