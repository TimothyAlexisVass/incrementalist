# Phase 12, Step 2: Ladder Climb

## 1. Game Concept & Rules

The **Ladder Climb** is a vertical progression mini-game where the player attempts to ascend a ladder to reach increasingly lucrative reward tiers. Unlike push-your-luck games, there are no voluntary stops, no claim choices, and no risk of losing previously accumulated rewards. 

The player simply rolls to advance step-by-step; the game continues until an advancement roll fails (or they reach the top/cap), at which point they are awarded the reward associated with the highest successfully reached rung.

### Core Rules:
1. **Starting Point**: Spending a daily-bonus token starts the session at **Rung 1**, which is guaranteed ($100\%$ base success rate) and grants a baseline `tier_1` reward.
2. **Advancement**: At each rung, the player clicks the **`Climb`** button to attempt to advance to the next rung. The base success rate declines significantly with higher rungs.
3. **Outcome**:
   - **Success**: The player ascends to the next rung (e.g., Rung 1 $\rightarrow$ Rung 2).
   - **Failure**: The climb session ends immediately. The player is awarded the placeholder reward of their current highest successfully reached rung.
4. **Ladder Cap**: The ladder is represented as a tower of up to 20 visible rungs. However, the ultimate reward tier (`tier_7`) is reached and capped at Rung 7 and above.

---

## 2. Mathematical Formulas & Streak Scaling

- **Streak Climb Bonus**: The daily login streak adds a direct percentage point advancement bonus to all climb rolls:
  $$\text{climb\_chance\_bonus} = \min\left(\frac{\text{streak}}{60}, 1.0\right) \times 1\% \text{ (or 0.01 max)}$$
  *Example*: A player with a maximum streak of 60 gets a $+1\%$ probability bonus added directly to their climb chances. If a base climb chance is $5\%$, the player's actual chance becomes $6\%$.
- **Rung Advancement Table**:
  Every climb attempt rolls against the base advancement chance of the target rung, plus the streak bonus (capped at $100\%$ total chance):

  | Target Rung | Reward Tier | Base Success Rate | Cumulative Chance (No Streak) | Description |
  | :---: | :---: | :---: | :---: | --- |
  | **1** | `tier_1` | `100%` | `100%` | Guaranteed starting position |
  | **2** | `tier_2` | `80%` | `80%` | High probability transition |
  | **3** | `tier_3` | `50%` | `40%` | Coin-flip transition |
  | **4** | `tier_4` | `25%` | `10%` | Low-probability transition |
  | **5** | `tier_5` | `10%` | `1%` | High-difficulty transition |
  | **6** | `tier_6` | `5%` | `0.05%` | Extreme-difficulty transition |
  | **7+** | `tier_7` | `1%` | `0.0005%` | Maximum ultimate reward rung |

---

## 3. UI Representation & Layout

The WebGL interface displays a vertical column of boxes on the screen:
- **Ladder Rungs**: 20 stacked rectangular boxes, ordered vertically from Rung 1 at the bottom to Rung 20 at the top.
- **Current Position Indicator**: A glowing highlight or colored box representing the player's current successfully reached rung.
- **Rewards Display**: Each rung box displays its associated reward tier (Rung 1: Common, Rung 2: Rare, etc., up to Rung 7+ which glows as Ultimate).
- **Controls**: A single button is visible at the bottom of the screen:
  - **`Climb`**: Launches the next ascension roll.
- **Completion State**: When a climb roll fails, the game displays the final rung reached and the reward granted.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/ladder_climb.ex`)
- **Session Struct**: `LadderSession` stores:
  - `current_rung`: Integer tracking the player's current successfully occupied rung ($1$ to $20$).
  - `status`: Atom tracking session state (`:active` or `:completed`).
  - `streak_before`: The daily streak value captured on session start.
  - `collected_reward`: The reward ID granted upon completion.
- **Actions**:
  - `start_session(streak)`: Initiates the session, starting the player safely at Rung 1.
  - `climb()`: 
    - Verifies the status is `:active`.
    - Looks up the base success rate for the target rung (`current_rung + 1`).
    - Rolls a random float $r \in [0.0, 1.0)$. If $r < \text{base\_rate} + \text{climb\_chance\_bonus}$, increments `current_rung` by 1.
    - If the roll fails, sets status to `:completed` and assigns the current rung's reward to `collected_reward`.

### TypeScript Frontend (`assets/src/features/bonustime/ladder-climb/`)
- **`view-model.ts`**: Derives the list of 20 rungs, highlighting the player's active position, identifying climbed rungs, and formatting the button's state.
- **`render.ts`**: WebGL Canvas rendering. Draws the vertical ladder rungs with clean borders, rendering a glowing character marker that ascends between boxes. Displays brief particle effects on successful climb or a fade-out/lock effect when the climb fails.
- **`interactions.ts`**: Binds screen regions for the `Climb` button clicks, dispatching the corresponding server actions.

---

## 5. Verification & Testing
- Assert that entering the game always starts safely on Rung 1 with no chance of failure.
- Verify that climb chance mathematical equations are strictly enforced.
- Add test suites demonstrating that attempting to climb after a failure throws an error.
