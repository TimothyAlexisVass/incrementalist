# Phase 12, Step 2: Ladder Climb

## 1. Game Concept & Rules

The **Ladder Climb** is a vertical push-your-luck mini-game. The player climbs up a vertical ladder composed of rungs, where higher rungs offer progressively better reward tiers. However, each climb attempt carries a risk of slipping, which ends the game immediately.

### Core Rules:
1. **Starting Point**: The player spends a daily-bonus token to start at **Rung 1**, which is guaranteed ($100\%$ base success rate) and grants a baseline `tier_1` reward.
2. **The Choice (Climb vs. Claim)**: At each rung, the player faces a choice:
   - **Climb**: Attempt to ascend to the next rung. The chance of success declines significantly at higher rungs.
   - **Claim**: Voluntarily stop climbing. This claims the reward of the current rung and completes the session safely.
3. **Slipped Outcome**: If a climb roll fails, the player slips off the ladder. The game ends instantly. The player does not receive the reward of the rung they tried to reach; instead, they are awarded the reward of the highest rung they had successfully stood on before slipping.
4. **Ladder Cap**: The ladder is represented as a tower of up to 20 rungs, but the ultimate reward `tier_7` is reached and capped at Rung 7 and above.

---

## 2. Mathematical Formulas & Streak Scaling

- **Streak Climb Bonus**: The login streak adds a direct percentage point advancement bonus to all climb rolls:
  $$\text{climb\_chance\_bonus} = \min\left(\frac{\text{streak}}{60}, 1.0\right) \times 1\% \text{ (or 0.01 max)}$$
  *Example*: A player with a maximum streak of 60 gets a $+1\%$ probability bonus added directly to their climb chances. If a base climb chance is $5\%$, the player's actual chance becomes $6\%$.
- **Rung Advancement Table**:
  Every climb attempt rolls against the base advancement chance of the target rung, plus the streak bonus (capped at $100\%$ total chance):

  | Target Rung | Reward Tier | Base Success Rate | Description |
  | :---: | :---: | :---: | --- |
  | **1** | `tier_1` | `100%` | Guaranteed starting position |
  | **2** | `tier_2` | `80%` | High probability transition |
  | **3** | `tier_3` | `50%` | Coin-flip transition |
  | **4** | `tier_4` | `25%` | Moderate risk transition |
  | **5** | `tier_5` | `10%` | High risk transition |
  | **6** | `tier_6` | `5%` | Extreme risk transition |
  | **7+** | `tier_7` | `1%` | Maximum ultimate reward rung |

---

## 3. UI Representation & Layout

The WebGL interface displays a vertical column of boxes on the screen:
- **Ladder Rungs**: 20 stacked rectangular boxes, ordered vertically from Rung 1 at the bottom to Rung 20 at the top.
- **Current Position Indicator**: A glowing highlight or colored box represents the player's current successfully reached rung.
- **Rewards Display**: Each rung box displays its associated reward tier (Rung 1: Common, Rung 2: Rare, etc., up to Rung 7+ which glows as Ultimate).
- **Controls**: Two large buttons are visible at the bottom of the screen:
  - **`Climb`**: Launches the next ascension roll.
  - **`Claim`**: Secures the current position's reward and ends the game.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/ladder_climb.ex`)
- **Session Struct**: `LadderSession` stores:
  - `current_rung`: Integer tracking the player's current successfully occupied rung ($1$ to $20$).
  - `status`: Atom tracking session state (`:active` or `:slipped`).
  - `streak_before`: The daily streak value captured on session start.
  - `collected_reward`: The reward ID granted upon completion.
- **Actions**:
  - `start_session(streak)`: Initiates the session, starting the player safely at Rung 1.
  - `climb()`: 
    - Verifies the status is `:active`.
    - Looks up the base success rate for the target rung (`current_rung + 1`).
    - Rolls a random float $r \in [0.0, 1.0)$. If $r < \text{base\_rate} + \text{climb\_chance\_bonus}$, increments `current_rung` by 1.
    - If the roll fails, sets status to `:slipped` and awards the reward tier of the current rung.
  - `claim()`: Validates that status is `:active`, assigns the current rung's reward to the session, and sets the status to `:complete`.

### TypeScript Frontend (`assets/src/features/bonustime/ladder-climb/`)
- **`view-model.ts`**: Derives the list of 20 rungs, highlighting the player's active position, identifying climbed rungs, and formatting buttons state.
- **`render.ts`**: WebGL Canvas rendering. Draws the vertical ladder rungs with clean borders, rendering a glowing character marker that ascends between boxes. Displays brief slip particles or animations if the player slips.
- **`interactions.ts`**: Binds screen regions for the `Climb` and `Claim` button clicks, dispatching the corresponding server actions.

---

## 5. Verification & Testing
- Assert that entering the game always starts safely on Rung 1 with no chance of failure.
- Verify that climb chance mathematical equations are strictly enforced.
- Add test suites demonstrating that attempting to climb after slipping throws an error.
