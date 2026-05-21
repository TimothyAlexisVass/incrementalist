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
4. **Final Throw and Auto-Claim**:
   - The player clicks `Throw Dice` to roll all seven dice.
   - If throws remain, they can toggle held dice and click `Throw Dice` again to reroll only the unheld dice.
   - On the final throw, the reward auto-resolves after `reward_modal_delay_ms` like the other bonus games and the session ends.

---

## 2. Streak Scaling & Roll Budgets

- **Rolls Budget**: The total number of rolls available per game is:
  $$\text{rolls} = 1 + \min\left(\lfloor\text{streak} / 30\rfloor, 2\right)$$
  - *Streak 0-15*: $1$ roll total (no rerolls allowed, pure one-shot roll).
  - *Streak 16-30*: $2$ rolls total ($1$ initial roll $+ 1$ reroll).
  - *Streak 31+*: $3$ rolls total ($1$ initial roll $+ 2$ rerolls).

---

## 3. Hand Combinations & Reward Tiers

When a hand settles, the server evaluates all seven dice faces. The best matching combination from the following hierarchy determines the reward tier. All possible rolls of seven 7-sided dice fit into one of these 17 ranks:
Combination | Tier
Full house | 1
Two pairs | 1
Four-of-a-kind + pair | 1
Full house + pair | 2
Three pairs | 2
Two triples | 2
Three-of-a-kind | 3
Four + three | 3
Large straight | 4
Four-of-a-kind | 4
A single pair | 4 (Single pair of 1-6 _without_ getting a straight)
7-leaf clover | 5 (Single pair of 7s _without_ getting a straight)
Five + pair | 5
Five-of-a-kind | 5
Small straight | 5
Full straight | 6
Six-of-a-kind | 6
Seven-of-a-kind | 7

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/lucky_dice.ex`)
- **Session Struct**: `DiceSession` stores:
  - `rolls_left`: Number of rerolls remaining.
  - `current_dice`: Array of 7 integers (each $1$ to $7$) representing active face values.
  - `held_indexes`: Set of integers ($0$ to $6$) indicating which dice are locked.
- **Persistence**: The active dice session is persisted so reconnects restore the exact in-progress board, held dice, and remaining rolls.
  - Store it in `bonustime.active_session` as type `lucky_dice`.
- **Actions**:
  - `start_session(streak)`: Computes roll budget, rolls 7 random values, and initializes the session.
  - `toggle_hold(index)`: Validates that `index` is between $0$ and $6$. Adds or removes it from `held_indexes`.
  - `throw_dice()`: 
    - Verifies `rolls_left > 0`.
    - Rolls all seven dice on the first throw, then rolls only the unheld dice on later throws.
    - Decrements `rolls_left`.
    - Leaves `held_indexes` intact so the player can unhold dice before the next throw.
    - If this was the final throw, resolves the reward automatically after `reward_modal_delay_ms` and ends the session.

### TypeScript Frontend (`assets/src/features/bonustime/lucky-dice/`)
- **`view-model.ts`**: Projects the 7 dice faces, held statuses, and current identified hand combination.
- **`render.ts`**: WebGL Canvas rendering. Draws seven premium dice boxes on the canvas, each showing its face number. Displays small glowing checkmarks or borders to represent "held" status.
- **`interactions.ts`**: Clicking a die toggles hold status; clicking Roll or Claim triggers commands.

---

## 5. Verification & Testing
- Assert that hand evaluation logic correctly resolves all 16 combination ranks.
- Test that rolls budget decreases correctly and blocks actions when 0.
- Verify that claiming a hand resets the board and rolls a full new set of dice if rolls remain.
