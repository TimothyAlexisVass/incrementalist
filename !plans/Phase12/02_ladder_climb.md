# Phase 12, Step 2: Ladder Climb

## 1. Game Concept & Rules

The **Ladder Climb** is a deterministic, single-shot ascent reveal. Spending one daily-bonus token causes the server to generate the full ladder outcome up front, then the client animates the climb rung-by-rung.

Any branch glow, rung highlight, or split-lane flourish is cosmetic only. If the UI presents a choice, it is only an illusion of choice and must not change the reward outcome.

### Core Rules:
1. Spending a token starts one server-authoritative ladder resolution.
2. The server rolls the full ascent path once, from Rung 1 until the first failure or the cap.
3. The client replays that path as an animation.
4. The reward is the tier attached to the highest successfully reached rung.
5. The 20 visible rungs are presentation only; rewards still cap at `tier_7`.

---

## 2. Deterministic Path Generation & Streak Scaling

- **Streak Climb Bonus**: The daily login streak adds a direct percentage point bonus to every rung success roll:
  $$\text{climb\_chance\_bonus} = \min\left(\frac{\text{streak}}{60}, 1.0\right) \times 1\%$$
  *Example*: A player with a maximum streak of 60 gets a `+1%` probability bonus added directly to each climb chance.
- **One-Shot Path Roll**:
  The server evaluates the rung table once when the token is spent. The client then replays the stored rung outcomes as the ladder animation. There is no per-rung server retry or manual stop point.
- **Rung Advancement Table**:
  Every climb resolution uses the base advancement chance for the target rung, plus the streak bonus, capped at `100%` total chance:

  | Target Rung | Reward Tier | Base Success Rate | Cumulative Chance (No Streak) | Reveal Role |
  | :---: | :---: | :---: | :---: | --- |
  | **1** | `tier_1` | `100%` | `100%` | Guaranteed starting rung |
  | **2** | `tier_2` | `80%` | `80%` | Early climb success |
  | **3** | `tier_3` | `50%` | `40%` | Mid-ladder transition |
  | **4** | `tier_4` | `25%` | `10%` | Low-probability transition |
  | **5** | `tier_5` | `10%` | `1%` | High-difficulty transition |
  | **6** | `tier_6` | `5%` | `0.05%` | Extreme-difficulty transition |
  | **7+** | `tier_7` | `1%` | `0.0005%` | Maximum reward cap |

---

## 3. UI Representation & Layout

The WebGL interface displays a vertical column of boxes on the screen:
- **Ladder Rungs**: 20 stacked rectangular boxes, ordered vertically from Rung 1 at the bottom to Rung 20 at the top.
- **Current Position Indicator**: A glowing highlight or colored box representing the rung currently being replayed.
- **Rewards Display**: Each rung box displays its associated reward tier, with Rung 7+ sharing the ultimate cap display.
- **Cosmetic Choice Layer**: If branch prompts or split-lane art are shown, they only decorate the reveal path and do not alter the reward.
- **Controls**: A single `Climb` button starts the one-shot reveal.
- **Completion State**: When the replay finishes, the game displays the final rung reached and the reward granted.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/ladder_climb.ex`)
- **Roll Function**: `roll_reward(streak)` returns the full ascent result in one shot.
- **Returned Data**: The payload should include the rung path, the highest successful rung, and the final reward tier.
- **Path Structure**: `rungs` or `path` should capture the precomputed success/failure sequence so the client can animate it deterministically.
- **No Multi-Step Session**: There is no iterative `climb()` command, no `:active` / `:completed` loop, and no second authoritative click.
- **Streak Handling**: The streak bonus is applied once when generating the path, not on a later retry.

### TypeScript Frontend (`assets/src/features/bonustime/ladder-climb/`)
- **`view-model.ts`**: Derives the 20-rung ladder, the replay progress, and any cosmetic branch styling from the server result.
- **`render.ts`**: WebGL Canvas rendering. Draws the ladder, animates the stored rung path, and highlights the final rung reached.
- **`interactions.ts`**: Sends the single `Climb` command and treats any branch-flavor UI as cosmetic only.

---

## 5. Verification & Testing
- Assert that one token spend always returns a full rung path and a final reward tier.
- Verify that the streak bonus is applied once to the precomputed climb path.
- Test that cosmetic branch or highlight selection does not alter the authoritative outcome.
- Confirm that the reward still caps at `tier_7` for `Rung 7+`.
