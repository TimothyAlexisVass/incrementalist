# Phase 12, Step 7: Hammer Smash (Tivoli High Striker)

## 1. Game Concept & Rules

**Hammer Smash** is an interactive, timing-based volatility mini-game modeled after a carnival high-striker. The player times two striker hits on a rapidly fluctuating power meter. The combined force drives a ball up a vertical tower, aiming to strike the bell at the top to unlock an extra bell-shattering reward.

### Core Rules:
1. **Timing Meter**: A horizontal power meter constantly sweeps back and forth between a minimum floor and $100\%$.
2. **Smashes**: The player gets **2 normal smashes**.
3. **Interactive Strike**: 
   - The player timing-clicks the `Smash` button while the meter is moving.
   - To simulate a physical swing delay, once clicked, the meter continues moving along its sweep path for a random additional distance between $30\%$ and $200\%$ of a full sweep before stopping.
   - The stopped meter position determines the power of that smash.
4. **Striker Accumulation**: The average power of the two normal smashes determines how high the marker rises on the striker pole:
   $$\text{pole\_height} = \min\left(100\%, \frac{\text{smash\_1\_power}}{2} + \frac{\text{smash\_2\_power}}{2}\right)$$
5. **Bell Strike (Extra Smash)**:
   - If the combined height reaches exactly $100\%$, the marker strikes the bell at the top.
   - This awards a base `tier_6` reward and unlocks **one extra smash attempt**.
   - The extra smash is a final timed hammer blow. The power of this blow determines the extent of the bell's destruction, yielding a high-tier bonus reward in addition to the base prize.

---

## 2. Mathematical Formulas & Streak Scaling

- **Minimum Meter Floor**: The login streak raises the lower bound of the moving power sweep, clamping worst-case timing:
  $$\text{min\_amount} = 5 + \min\left(\frac{\text{streak}}{15}, 15\right)\%$$
  - *Base floor*: $5\%$.
  - *Streak cap*: Max $20\%$ minimum power floor (achieved at streak 225+).
- **Pole Height Reward Table**:
  The final pole height after 2 normal smashes maps to these baseline rewards:

  | Pole Height | Reward Tier | Description / Milestone |
  | :---: | :---: | --- |
  | `0%` to `<15%` | `tier_1` | Weak strike |
  | `15%` to `<30%` | `tier_2` | Low strike |
  | `30%` to `<60%` | `tier_3` | Average strike |
  | `60%` to `<75%` | `tier_4` | Solid strike |
  | `75%` to `<90%` | `tier_5` | Strong strike |
  | `90%` to `<100%` | `tier_6` | Elite strike |
  | `100%` (Bell hit) | `tier_6` + "Smash the Bell" Extra Smash | Perfect bell-strike milestone |

- **"Smash the Bell" Extra Rewards**:
  If the bell is hit, the power of the extra smash rolls a bonus reward:

  | Extra Smash Power | Bell Shatter Outcome | Extra Reward Tier |
  | :---: | --- | :---: |
  | `<50%` | Bell cracks | `tier_4` |
  | `50%` to `<75%` | Bell cracks a lot | `tier_5` |
  | `75%` to `<90%` | Bell breaks | `tier_6` |
  | `>90%` | Bell shatters perfectly | `tier_7` |

---

## 3. UI Representation & Layout

The WebGL striker tower is laid out vertically:
- **Striker Pole**: A tall vertical metal tower with a bell icon situated at the very top.
- **Sweeping Power Bar**: A horizontal meter that moves back and forth dynamically, showing a colored gradient from red (weak) to bright gold (strong).
- **Click Indicator**: Draws a marker showing the player's clicked timing alongside a separate marker showing the final server-calculated variance power.
- **Ascending Ball**: A metal indicator ball slides up the vertical pole following each smash, settling at `pole_height`.
- **Destruction Particles**: Splinters and shatter particles burst from the bell on perfect hits.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/hammer_smash.ex`)
- **Session Struct**: `SmashSession` stores:
  - `smash_count`: Integer tracking active smash (0, 1, 2, or 3 for extra).
  - `smash_1_power`: Integer power of the first strike.
  - `smash_2_power`: Integer power of the second strike.
  - `extra_smash_power`: Integer power of the bonus striker hit.
  - `pole_height`: Combined strike elevation ($0$ to $100\%$).
  - `streak_before`: The streak value captured on session start.
  - `collected_rewards`: List of rewards.
- **Actions**:
  - `start_session(streak)`: Computes the minimum floor parameter and starts in a neutral state.
  - `submit_smash(client_click_value, sweep_direction)`: 
    - Validates that the click value is within valid bounds.
    - Rolls a random overshoot distance between $30\%$ and $200\%$ of a full sweep.
    - Computes power based on where the meter stops after moving the overshoot distance in the current sweep direction (bouncing off boundaries at the minimum floor and $100\%$).
    - If `smash_count == 0`: records `smash_1_power`.
    - If `smash_count == 1`: records `smash_2_power`, calculates final `pole_height`. If `pole_height == 100\%`, activates extra bell phase.
    - If `smash_count == 2` (extra bell phase): records `extra_smash_power` and maps the bell shatter tier.
  - `complete_session()`: Distributes rewards.

### TypeScript Frontend (`assets/src/features/bonustime/hammer-smash/`)
- **`view-model.ts`**: Handles the sweep timing loops, highlighting timing lines, and calculating visual striker elevations.
- **`render.ts`**: WebGL Canvas rendering. Sweeps the horizontal bar, slides the striker ball up the tower, and triggers bell cracking or perfect shattering explosion particles.
- **`interactions.ts`**: Clicking `Smash` locks the timing coordinate and fires the server event.

---

## 5. Verification & Testing
- Assert that streak correctly raises the meter floor limit.
- Test that two perfect $100\%$ smashes trigger the extra bell-break phase.
- Verify that standard and extra rewards are correctly aggregated upon final completion.
