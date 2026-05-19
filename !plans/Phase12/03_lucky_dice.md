# Phase 12, Step 3: Lucky Dice (7x7 Dice)

## 1. Game Concept & Rules

**Lucky Dice** (also known as **7x7 Dice**) is a dice-rolling mini-game combining chance and Yatzy-like strategy. The player rolls seven 7-sided dice (faces labeled $1$ to $7$) and attempts to form high-tier combinations over a series of rolls.

### Core Rules:
1. **Initial Roll**: The player starts by rolling all seven 7-sided dice.
2. **Hold and Reroll**: 
   - The player reviews the rolled faces and selects any number of dice to "hold" (save).
   - They click `Reroll` to roll only the unheld dice, attempting to improve their hand.
   - The player can select and change which dice are held before each reroll.
3. **Roll Budget**: The total number of rolls available in a single game scales with the daily login streak.
4. **Claim and Reset**:
   - The player can click `Claim` at any point to secure the reward associated with their current best hand.
   - If they claim a reward and still have rolls left in their budget, all seven dice are reset, and they get to roll all seven dice again, allowing them to potentially score multiple rewards in a single session!

---

## 2. Streak Scaling & Roll Budgets

- **Rolls Budget**: The total number of rolls available per game is:
  $$\text{rolls} = 1 + \min\left(\lfloor\text{streak} / 30\rfloor, 2\right)$$
  - *Streak 0-29*: $1$ roll total (no rerolls allowed, pure one-shot roll).
  - *Streak 30-59*: $2$ rolls total ($1$ initial roll $+ 1$ reroll).
  - *Streak 60+*: $3$ rolls total ($1$ initial roll $+ 2$ rerolls).

---

## 3. Hand Combinations & Reward Tiers

When a hand settles, the server evaluates all seven dice faces. The best matching combination from the following hierarchy determines the reward tier. All possible rolls of seven 7-sided dice fit into one of these 16 ranks:

| Rank | Combination | Hand Definition / Example | Occurrence Probability | Reward Tier |
| :---: | --- | --- | :---: | :---: |
| **1** | Two pairs | Two distinct pairs of matching faces (e.g. `2,2, 4,4, 1,3,5`) | `32.1295%` | `tier_1` |
| **2** | Full house | 3-of-a-kind + 1 pair (e.g. `5,5,5, 2,2, 1,4`) | `21.4196%` | `tier_1` |
| **3** | Three pairs | Three distinct pairs of matching faces (e.g. `1,1, 3,3, 6,6, 2`) | `10.7098%` | `tier_1` |
| **4** | Three-of-a-kind | 3 matching faces (e.g. `4,4,4, 1,2,3,5`) | `10.7098%` | `tier_1` |
| **5** | A single pair | 1 pair (e.g. `3,3, 1,2,4,5,6`) | `9.1800%` | `tier_1` |
| **6** | Small straight | 5 consecutive faces (e.g. `1-2-3-4-5` or `2-3-4-5-6` or `3-4-5-6-7`) | `3.6719%` | `tier_2` |
| **7** | Four-of-a-kind | 4 matching faces (e.g. `2,2,2,2, 1,3,5`) | `3.5699%` | `tier_2` |
| **8** | Full house + two pairs | 3-of-a-kind + two distinct pairs (e.g. `3,3,3, 4,4, 5,5`) | `2.6775%` | `tier_3` |
| **9** | Four-of-a-kind + pair | 4-of-a-kind + 1 pair (e.g. `2,2,2,2, 6,6, 1`) | `2.6775%` | `tier_3` |
| **10** | Two triples | Two distinct 3-of-a-kinds (e.g. `4,4,4, 5,5,5, 1`) | `1.7850%` | `tier_4` |
| **11** | Full straight | 7 consecutive faces (`1-2-3-4-5-6-7`) | `0.6120%` | `tier_5` |
| **12** | Five-of-a-kind | 5 matching faces (e.g. `3,3,3,3,3, 1,2`) | `0.5355%` | `tier_5` |
| **13** | Four + three | 4-of-a-kind + 3-of-a-kind (e.g. `1,1,1,1, 3,3,3`) | `0.1785%` | `tier_6` |
| **14** | Five + pair | 5-of-a-kind + 1 pair (e.g. `6,6,6,6,6, 2,2`) | `0.1071%` | `tier_6` |
| **15** | Six-of-a-kind | 6 matching faces (e.g. `5,5,5,5,5,5, 1`) | `0.0357%` | `tier_6` |
| **16** | Seven-of-a-kind | All 7 dice matching (e.g. `4,4,4,4,4,4,4`) | `0.00085%` | `tier_7` |

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/lucky_dice.ex`)
- **Session Struct**: `DiceSession` stores:
  - `rolls_left`: Number of rerolls remaining.
  - `current_dice`: Array of 7 integers (each $1$ to $7$) representing active face values.
  - `held_indexes`: Set of integers ($0$ to $6$) indicating which dice are locked.
  - `collected_rewards`: List of reward IDs earned during this session.
- **Actions**:
  - `start_session(streak)`: Computes roll budget, rolls 7 random values, and initializes the session.
  - `toggle_hold(index)`: Validates that `index` is between $0$ and $6$. Adds or removes it from `held_indexes`.
  - `reroll()`: 
    - Verifies `rolls_left > 0`.
    - Rolls a random face ($1-7$) for all index values *not* in `held_indexes`.
    - Decrements `rolls_left`.
    - Clears `held_indexes`.
  - `claim_combination()`: Evaluates `current_dice`, maps it to the matching hand tier, appends it to `collected_rewards`, resets `held_indexes`, and rolls a fresh set of 7 dice (if `rolls_left > 0`).
  - `complete_session()`: Validates that no actions remain or player completes manually, adding all earned rewards to player state.

### TypeScript Frontend (`assets/src/features/bonustime/lucky-dice/`)
- **`view-model.ts`**: Projects the 7 dice faces, held statuses, and current identified hand combination.
- **`render.ts`**: WebGL Canvas rendering. Draws seven premium dice boxes on the canvas, each showing its face number. Displays small glowing checkmarks or borders to represent "held" status.
- **`interactions.ts`**: Clicking a die toggles hold status; clicking Roll or Claim triggers commands.

---

## 5. Verification & Testing
- Assert that hand evaluation logic correctly resolves all 16 combination ranks.
- Test that rolls budget decreases correctly and blocks actions when 0.
- Verify that claiming a hand resets the board and rolls a full new set of dice if rolls remain.
