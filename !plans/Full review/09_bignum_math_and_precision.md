# Step 9: BigNum Math & Precision Review Plan

This step governs high-precision scientific representations, Ecto JSONB serializations, arithmetic normalization formulas, comparison algorithms, and dual-mode UI suffix formatting.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **BigNum Representation**: Defined in `assets/src/core/bignum.ts` as a normalized object carrying a 15-digit mantissa (`m`) and base-10 exponent (`e`): `{ m: number, e: number }`.
- **Normalization Enforcement (`normalize`)**: Keeps mantissa values strictly bounded (`1 <= abs(m) < 10`) and formats floating-point rounding errors to roughly 15 significant digits using `.toPrecision(15)`.
- **Operations Library**: Pure functions perform math without overflow hazards:
  - `add(a, b)`, `sub(a, b)`, `mul(a, b)`, `div(a, b)`, `pow(a, p)`, `compare(a, b)`.
  - Underflows are discarded: if the difference in exponents exceeds `16`, the smaller operand is ignored.
- **Dual-Mode Presentation Formatter (`formatBigNum`)**: Converts values into formatted strings based on the toggle setting (`assets/src/utils/format.ts`):
  - `'scientific'`: standard notation (e.g. `1.345e12`).
  - `'suffixed'`: human-readable tier marks: `M` (million), `B` (billion), `T` (trillion), `Qa`, `Qi`, etc.
  - Large thousands under 1M (exponents < 6) are written out with space marks (e.g. `456 200`) instead of calling the `K` suffix, matching premium requirements.

### Server (Elixir)
- **Ecto Schema Serialization**: High-precision fields (coins, shards, cores, exp, sisu) are persisted as `embeds_one` in database tables, serializing to native `{m, e}` JSON structures.
- **Rules Library (`lib/incrementalist/game/big_num.ex`)**: Mirrors the client-side math logic to guarantee identical calculations for gains, costs, and multipliers without rounding drift.

---

## Step-by-Step Execution Verification Plan

### 1. Operations Integrity Check
- **Verify**: Audit codebase for forbidden operators on high-precision attributes:
  - Check that no client code uses standard math operators (`+`, `-`, `*`, `/`) directly on Sisu, Coins, Exp, Shards, or Cores.
  - Check that all operations are performed via `add`, `sub`, `mul`, `div`, or `pow` from `assets/src/core/bignum.ts`.
- **Rule Check**: Direct calculations on numerical indices are strictly forbidden to prevent float overflow under high exponents.

### 2. Normalization Verification
- **Verify**: Adding small numbers to large exponents (difference > 16) returns the large number correctly without floating-point errors.
- **Verify**: Floating-point drift (such as `9.999999999999999`) is correctly normalized to `{ m: 1.0, e: 10 }` instead of leaving `10` as a mantissa.

### 3. Dual-Mode UI Rendering & Suffix Scales
- **Verify**: Verify high currencies show:
  - Exact spaces for thousands under 1M (e.g., 500,000 displays as `"500 000"`, never `"500K"`).
  - Clean `M`, `B`, and `T` suffixes for values over 1M.
- **Verify**: Toggle format settings in the menu between `'suffixed'` and `'scientific'`.
- **Verify**: Top HUD values adapt instantly, transforming all balances cleanly without shifting component widths.
