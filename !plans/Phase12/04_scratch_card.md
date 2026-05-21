# Phase 12, Step 4: Scratch Card (Threshold Reveal)

## 1. Game Concept & Rules

The Scratch Card is a pre-rolled reveal game. Scratch position is cosmetic; only cumulative scratched pixels affect progress.

There will be a grid of 5x5 pixel cells on the board.
As each grid cell is touched, 25 pixels are deducted from the pixel budget, that cell is removed and replaced with a burst of particles. The particles have a slightly different color from the scratch surface so that they will show against the surface.

### Core Rules:
1. The card board is `1000 x 500` pixels.
2. The server rolls the scratch budget, and reveal schedule before play starts.
3. The player drags a 10 pixels high times 20 pixels wide rectangular scratcher brush across the screen to erase the protective overlay.
4. The reveal schedule is an ordered list of cumulative scratch thresholds paired with reward tiers.
5. Scratch location does not affect reward outcome. Each newly uncovered pixel deducts `1` pixel from the scratch budget. So reward outcome is independent of where the player scratches.
6. When cumulative scratched pixels reaches a threshold, the next scratch touch reveals the scheduled reward => the reward is placed under a square of 15x15 unscratched cells in proximity with the cell that was removed to reach the threshold. If that is not possible, the reveal is deferred until a 15x15 uncratched area exists in proximity of the newly removed cell. Then, the covering 225 cells get scratched and deducts thus deducting those `5625` pixels
7. Once scratching has started, it continues until all pixels have been deducted from the budget.



---

## 2. Mathematical Formulas & Streak Scaling

- **Pixel Budget**: The scratch budget scales with daily login streak:
  `pixels = 500,000 * (rand(0.10, 0.16) + min(streak * 0.001, 0.15))`
  - This gives a base budget: `50,000` to `80,000` pixels with a Streak bonus of up to `15%` extra area budget.
  - Total range: `10%` to `31%` of the total card area.
- **Reveal Count**: The server rolls how many rewards the player will uncover. A maximum of 10.
- **Reveal Tier Table**: Tier names come from `shared/requirements/bonustime.json.reward_tiers`.

## 3. Reward generation
First roll how many rewards the player will uncover.
The pixel budget determines the reward count range using square-root scaling.

At 10% pixel budget:
min_rewards = 1
max_rewards = 4

At 31% pixel budget:
min_rewards = 5
max_rewards = 8

Because lower pixel budgets should be more likely to receive a higher reward count within their range, and higher pixel budgets should be less likely to receive a higher reward count within their range, the roll is biased inversely to the pixel budget.

budget_t = (pixel_budget - 0.10) / (0.31 - 0.10)
Where:
budget_t = 0 at 10% pixel budget
budget_t = 1 at 31% pixel budget

Then define the reward roll bias:
bias = 0.75 - (budget_t * 0.50)
So:
- At 10% budget, bias = 0.75, moderately favoring higher reward counts
- At 31% budget, bias = 0.25, moderately favoring lower reward counts

The reward count is then rolled inside the current reward range using this bias.

Example:
```
const minBudget = 0.10;
const maxBudget = 0.31;

const budgetT = Math.min(
  1,
  Math.max(0, (pixelBudget - minBudget) / (maxBudget - minBudget))
);

const scale = Math.sqrt(pixelBudget / maxBudget);

const minRewards = Math.max(1, Math.floor(3 * scale));
const maxRewards = Math.min(8, Math.floor(8 * scale));

const bias = 0.75 - (budgetT * 0.50);

const r = Math.random();

const shaped =
  bias * Math.sqrt(r) +
  (1 - bias) * (r * r);

const rewardCount =
  minRewards + Math.floor(shaped * (maxRewards - minRewards + 1));
```

Then for each reward, roll the tier:
  | Tier | Global Tier Name | Chance per Reveal | Placeholder Reward ID |
  | :---: | --- | :---: | --- |
  | **1** | `Common` | `50.9%` | `tier_1` |
  | **2** | `Rare` | `32%` | `tier_2` |
  | **3** | `Excellent` | 11%` | `tier_3` |
  | **4** | `Supreme` | `4%` | `tier_4` |
  | **5** | `Legendary` | `1.4%` | `tier_5` |
  | **6** | `Celestial` | `0.6%` | `tier_6` |
  | **7** | `Divine` | `0.1%` | `tier_7` |

Finally set a random pixel uncover number for each item, but they must be at least 8000 pixels (320 grid cells) apart.

Final result will look something like this, example for 4 rewards:
{
  "total_budget": 78442,
  "rewards": [
    {"pixels": 3014, "tier": 3},
    {"pixels": 11434, "tier": 1},
    {"pixels": 22120, "tier": 5},
    {"pixels": 54227, "tier": 2}
  ]
}

---

## 4. Reveal Schedule & Tracking

To keep the game deterministic and cosmetic at the scratch layer:
1. The result payload contains an ordered reveal schedule such as `[{ "pixels": 12346, "tier": 3 }, { "pixels": 49922, "tier": 2 }]`.
2. Once the cumulative scratched pixel count reaches a threshold, the next scratch touch advances to the scheduled reveal.
3. No item positions, collision grid, or coordinate-based reward validation are exposed.

---

## 5. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/scratch_card.ex`)
- `roll_reward(streak)` returns:
  - `pixels_budget`
  - `reveal_schedule` as an ordered list of `{pixels_uncovered, tier}` entries
  - final reward data derived from that schedule
- The backend does not expose item positions or accept per-drag commands.
- There is no `scratch_drag` or `release_brush` server loop.
- The result is deterministic for replay and idempotent for reconnect.
- Rewards are granted from the precomputed schedule, not from client geometry.

### TypeScript Frontend (`assets/src/features/bonustime/12-scratch-card/`)
- `view-model.ts`: projects `pixels_budget`, `scratched_pixels`, `reveal_schedule`, and revealed tiers into render state.
- `render.ts`: draws the scratch overlay, HUD, and reveal animation.
- `interactions.ts`: updates local scratch progress from pointer motion, and advances the next scheduled reveal when the threshold is reached. Scratch location only affects presentation.

---

## 5. Verification & Testing
- Test that identical total scratched pixels produce identical reveal progress regardless of where the pointer moved.
- Test that reveal thresholds are sorted and deterministic.
- Test that each reveal consumes `5625` pixels (75x75 cells) in addition to the scratched-pixel budget.
- Assert that no positions or other geometry-dependent hidden data appear in the payload.
