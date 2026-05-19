# Phase 12, Step 5: Card Pick (One-Shot Grid Game)

## 1. Game Concept & Rules

**Card Pick** is a single-step, server-authoritative card-flipping mini-game. The player is presented with a grid of 36 face-down cards. They use their allowed picks to flip cards and claim their rewards, with opportunities to trigger bonus phases that double card multipliers and grant additional picks.

### Core Rules:
1. **The Board**: A $6 \times 6$ grid containing 36 face-down cards.
2. **Picks Allowance**: The player starts with a base number of picks scaling with their streak.
3. **One-Shot Roll Logic**: 
   - When the player starts the game, the server rolls the entire 36-card layout and all bonus rolls in **one shot** (a single token-spend command).
   - The server computes the final `total_picks` count and the exact tier/multiplier value for each card in the grid.
   - The precalculated board state and pick count are sent back to the client.
4. **Client-Side Reveal**: 
   - The player selects cards in any order on their screen.
   - Each click flips a card to reveal its reward tier and multiplier. The outcomes are mapped sequentially from the server's precalculated payload (the first clicked card reveals the first item in the server's list, the second clicked card reveals the second, etc.).
5. **Final Missed Reveal**: Once `total_picks` cards have been selected and flipped, the remaining unclicked cards are flipped over and rendered in a dimmed state, showing the player what they missed.
6. **Consolidated Reward**: The player claims the sum of all rewards from their flipped cards.

---

## 2. Mathematical Formulas & Streak Scaling

- **Initial Picks**: The base number of allowed card flips scales with the login streak:
  $$\text{initial\_picks} = 2 + \min\left(7, \left\lfloor\frac{\max(0, \text{streak})}{7}\right\rfloor\right)$$
  - *Base picks*: $2$ cards.
  - *Streak cap*: Max $9$ initial picks (achieved at streak 49+).

- **Interactive Bonus Chain**:
  The server rolls consecutive checks to see if the player triggers additional bonus picks and card multiplier doublings:
  1. **Initial Bonus Phase (Bonus 1)**:
     - Roll chance: $\text{bonus\_chance} = 0.2 + 0.8 \times \frac{\text{streak}}{77}$. (Guaranteed at streak 77+).
     - On success: Adds $+1$ pick, and all remaining cards have their multipliers doubled ($2\times$).
  2. **Second Bonus Phase (Bonus 2)**:
     - Roll chance: Fixed **`10%`**.
     - On success: Adds $+1$ pick, and remaining cards have their multipliers doubled again ($4\times$).
  3. **Consecutive Bonus Phase**:
     - Roll chance: Fixed **`5%`** per roll.
     - The server rolls repeatedly until a roll fails or all cards are claimed. Each successive success adds $+1$ pick (with the multiplier remaining at $4\times$).
  
  $$\text{total\_picks} = \text{initial\_picks} + \text{bonus\_picks\_won}$$

---

## 3. Card Pool Rarity & Chance

The baseline reward tier (Tiers 1-7) for all 36 cards is pre-rolled using these exact weights:

| Tier | Card Outcome | Chance | Placeholder Reward ID |
| :---: | --- | :---: | --- |
| **1** | Common Card | `61.3%` | `tier_1` |
| **2** | Rare Card | `20%` | `tier_2` |
| **3** | Elite Card | `10%` | `tier_3` |
| **4** | Excellent Card | `5%` | `tier_4` |
| **5** | Unique Card | `2.5%` | `tier_5` |
| **6** | Exotic Card | `1%` | `tier_6` |
| **7** | Ultimate Card | `0.2%` | `tier_7` |

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/card_pick.ex`)
- **Functions**:
  - `roll_reward(streak)`:
    - Generates 36 card items, rolling their baseline tiers (1-7).
    - Computes `initial_picks`.
    - Evaluates the bonus chain rolls to determine `total_picks` and pre-applies the $2\times$ or $4\times$ doubling multipliers to the respective cards in the list.
    - Returns `{total_picks, board_cards}` where each card is `%{tier: integer, multiplier: integer}`.

### TypeScript Frontend (`assets/src/features/bonustime/card-pick/`)
- **`view-model.ts`**: Maintains the local state of clicked indexes, mapped card values from the server, and the active visual stage.
- **`render.ts`**: WebGL Canvas rendering. Draws the $6 \times 6$ card board. Handles card-flipping rotation animations (scaling and skewing). Renders glowing gold multiplier badges (e.g. `$2\times$`, `$4\times$`) on flipped cards, and renders unpicked cards with a dimmed opacity ($30\%$).
- **`interactions.ts`**: Listens for card grid clicks, incrementing local flips and locking interactions once `total_picks` is reached to trigger the final reveal sequence.

---

## 5. Verification & Testing
- Assert that baseline card probabilities sum to exactly $100\%$.
- Test the bonus phase calculations to ensure multipliers and pick limits are mathematically correct.
- Verify that no board layouts are exposed to the client prior to token consumption.
