# Phase 12, Step 6: Match Pairs (Stateful Memory Game)

## 1. Game Concept & Rules

**Match Pairs** is an interactive memory-matching mini-game. The player is presented with a grid of face-down tiles and attempts to find matching pairs to win rewards, with a limited number of misses allowed.

### Core Rules:
1. **The Board**: A grid of 48 face-down tiles containing exactly 24 distinct matching pairs.
2. **Turn Interaction**:
   - The player selects and flips one tile.
   - The player selects and flips a second tile.
3. **Match Success**: If the two flipped tiles contain the same symbol (matching reward tier and pair ID), they remain face-up permanently. The player secures that pair's reward.
4. **Match Mismatch**: If the two tiles do not match, they shake briefly, flip back face-down, and 1 miss is deducted from the player's mistake budget.
5. **Mistake Budget**: The player has a limit on incorrect matches. The game ends when all 24 pairs are successfully matched or when the mistake budget is exhausted.
6. **Consolation Reveal**: If the player exhausts their mistake budget on a mismatch, the matching tile to their final flipped tile is **automatically revealed and matched** for them, guaranteeing they walk away with at least 1 match reward from the session.

---

## 2. Mathematical Formulas & Streak Scaling

- **Mistake Budget (Miss Limit)**: The maximum number of allowed incorrect match attempts scales with the login streak:
  $$\text{miss\_limit} = 4 + \min\left(\left\lfloor\frac{\text{streak}}{15}\right\rfloor, 6\right)$$
  - *Base limit*: $4$ allowed mistakes.
  - *Streak bonus*: Adds up to $6$ additional allowed mistakes (achieved at streak 90+), for a maximum budget of $10$ misses.

- **Pair Rarity Table**:
  Each of the 24 pairs rolls its reward tier upon board initialization according to these exact weights:

  | Tier | Pair Rarity | Chance per Spawned Pair | Placeholder Reward ID |
  | :---: | --- | :---: | --- |
  | **1** | Common | `62.9581%` | `tier_1` |
  | **2** | Uncommon | `25%` | `tier_2` |
  | **3** | Rare | `8%` | `tier_3` |
  | **4** | Excellent | `3%` | `tier_4` |
  | **5** | Unique | `0.8%` | `tier_5` |
  | **6** | Exotic | `0.2%` | `tier_6` |
  | **7** | Ultimate | `0.0419%` | `tier_7` |

  *Note: Gives approximately a $1\%$ chance that at least one `tier_7` pair is present on the 24-pair board.*

---

## 3. UI Representation & Layout

The WebGL interface displays a clean card grid:
- **Grid Layout**: $6 \times 8$ or $8 \times 6$ layout of rectangular tiles.
- **Card States**:
  - *Hidden*: Drawn face-down (colored back with elegant borders).
  - *Flipped/Selected*: Rotates smoothly to show its face symbol/rarity color.
  - *Mismatch Shake*: Shakes side-to-side on mismatch before flipping back.
  - *Matched*: Remains face-up, highlighted in gold or glowing outlines.
- **HUD**: Displays the remaining allowed mistakes (misses) and pairs matched so far.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/match_pairs.ex`)
- **Session Struct**: `PairsSession` stores:
  - `status`: Atom tracking current visual state (`:selecting_first`, `:selecting_second`, `:complete`).
  - `board`: An array of 48 cards, each containing: `id` (integer 0-47), `pair_id` (integer 0-23 matching its twin), and `reward_tier`.
  - `revealed_indexes`: Set of card IDs that have been permanently matched.
  - `current_flips`: List containing up to 2 card IDs currently flipped in the active turn.
  - `misses_incurred`: Integer tracking incorrect matches.
  - `miss_limit`: Total incorrect matches allowed in this session.
- **Actions**:
  - `start_session(streak)`: Generates 24 pairs from the probability table, shuffles them into 48 positions, sets the miss limit, and starts in `:selecting_first`.
  - `flip_tile(index)`:
    - If first tile: updates `current_flips` and sets status to `:selecting_second`.
    - If second tile: compares its `pair_id` to the first tile. 
    - *If they match*: appends both IDs to `revealed_indexes` and returns to `:selecting_first`.
    - *If they mismatch*: increments `misses_incurred`. If `misses_incurred >= miss_limit`, triggers the consolation reveal of the second matching tile, marks the session as complete, and returns all rewards.
  - `complete_session()`: Finalizes the session, awarding all successfully matched cards.

### TypeScript Frontend (`assets/src/features/bonustime/match-pairs/`)
- **`view-model.ts`**: Projects tile statuses, active flips, and mistake count metrics.
- **`render.ts`**: WebGL Canvas rendering. Draws the 48 tiles, handling the 3D-like flip rotation, visual particle sparkles on matches, and side-to-side coordinate shaking on mismatches.
- **`interactions.ts`**: Maps grid click coordinates to `flip_tile` commands.

---

## 5. Verification & Testing
- Assert that board generator places exactly 24 pairs (48 tiles total).
- Test that mistake limits are enforced and block further selection.
- Verify that the consolation tile is correctly identified and flipped on the last miss.
