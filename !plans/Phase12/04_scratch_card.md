# Phase 12, Step 4: Scratch Card (Huge Scratch Card)

## 1. Game Concept & Rules

The **Scratch Card** is an interactive scrubbing mini-game. The player rubs off a protective foil overlay on a large virtual card to discover hidden reward items. They must manage a strict scrubbing brush budget and navigate a penalty for lifting their brush.

### Core Rules:
1. **The Card Board**: The virtual scratch card is a rectangular board of $1000 \times 500$ pixels.
2. **Hidden Items**: The card contains exactly 10 hidden reward items spawned at random coordinates. Each item has a bounding box of $64 \times 64$ pixels.
3. **The Scratcher**: The player drags an $8 \times 16$ rectangular scratcher brush across the screen to erase the protective overlay.
4. **Scratching Budget**: The player is granted a pixel-clearing budget. Each pixel cleared by the brush deducts 1 unit from the budget.
5. **Release Penalty**: Lifting the brush (releasing the mouse button or lifting a touch finger) incurs a heavy **20,000 pixel deduction** from the remaining budget. This strongly encourages the player to scratch the card in a single continuous path.
6. **Revealing Items**: An item is considered "fully revealed" when at least **$80\%$** of its bounding box area has been scrubbed clear. Once revealed, its reward tier is displayed on the board and added to the player's collection.

---

## 2. Mathematical Formulas & Streak Scaling

- **Pixel Budget**: The scratch budget (maximum number of pixels the player is allowed to erase) scales with their daily login streak:
  $$\text{pixels} = 500,000 \times \left(\text{rand}(0.10, 0.20) + \min(\text{streak} \times 0.01, 0.15)\right)$$
  - *Base budget*: Eerily $50,000$ to $100,000$ pixels.
  - *Streak bonus*: Adds up to $15\%$ extra area budget (achieved at streak 15+).
  - *Total range*: Allows the player to clear between $10\%$ and $35\%$ of the total card area.
- **Hidden Item Rarity Table**:
  Each of the 10 spawned hidden items rolls its reward tier upon card generation according to this exact weight table:

  | Tier | Hidden Item Outcome | Chance per Hidden Item | Placeholder Reward ID |
  | :---: | --- | :---: | --- |
  | **1** | Common item | `62.8995%` | `tier_1` |
  | **2** | Uncommon item | `25%` | `tier_2` |
  | **3** | Rare item | `8%` | `tier_3` |
  | **4** | Excellent item | `3%` | `tier_4` |
  | **5** | Unique item | `0.8%` | `tier_5` |
  | **6** | Exotic item | `0.2%` | `tier_6` |
  | **7** | Ultimate item | `0.1005%` | `tier_7` |

---

## 3. Grid Coordinates & Tracking System

To ensure smooth performance and avoid sending large raw coordinate packets:
1. **Grid Map**: The $1000 \times 500$ pixel surface is represented by a grid of $125 \times 62$ cells (where each cell corresponds to an $8 \times 8$ pixel block).
2. **Dragging Path**: As the player drags the cursor, the frontend computes a line segment between the previous and current coordinates. All cells in the $125 \times 62$ grid intersected by this segment are marked as "scratched/cleared."
3. **Budget Deductions**:
   - The server maintains the authoritative $125 \times 62$ boolean grid.
   - For every new cell marked as cleared, the budget is decremented by $64$ pixels ($8 \times 8$).
   - A brush release decreases the budget by $20,000$ pixels.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/scratch_card.ex`)
- **Session Struct**: `ScratchSession` stores:
  - `pixels_budget`: Remaining scratchable pixels.
  - `spawned_items`: Array of 10 item maps, each containing: `x`, `y`, `width` ($64$), `height` ($64$), and `reward_tier`.
  - `scratched_grid`: A 125x62 bitstring or nested boolean array representing scratched cells.
  - `collected_rewards`: List of rewards from items that have crossed the $80\%$ cleared threshold.
- **Actions**:
  - `start_session(streak)`: Generates 10 randomly placed item bounding boxes (ensuring they fit inside the $1000 \times 500$ card boundaries), rolls their reward tiers, calculates the pixel budget, and initializes the grid as fully covered.
  - `scratch_drag(points)`: Evaluates a list of coordinate lines. Marks newly cleared cells in the grid, subtracts $64$ pixels per new cell from `pixels_budget`, and checks if any item bounding boxes have reached $\ge 80\%$ clearance. If an item crosses the threshold, appends its reward to `collected_rewards`.
  - `release_brush()`: Subtracts $20,000$ pixels from `pixels_budget`.
  - `complete_session()`: Closes the session and transfers all earned items in `collected_rewards` to the player's inventory.

### TypeScript Frontend (`assets/src/features/bonustime/scratch-card/`)
- **`view-model.ts`**: Maintains a local copy of the $125 \times 62$ scratched cell array, remaining pixels budget, and centroids of items that have been fully revealed.
- **`render.ts`**: WebGL Canvas rendering. Draws the textured scratch card overlay. Scratched cells are rendered transparently by drawing a textured quad using a custom shader or a grid of vertex coordinates, allowing the hidden items below to shine through.
- **`interactions.ts`**: Binds drag/rub events. While dragging, batches coordinate points and sends them to the server as a `scratch_drag` command. Dispatches `release_brush` when dragging terminates.

---

## 5. Verification & Testing
- Test grid conversion calculations to verify that double-clearing the same coordinate does not double-deduct the pixel budget.
- Verify that the 20,000 pixel release penalty is applied strictly on lift-off.
- Assert that items are only awarded when crossing the $80\%$ clearance threshold.
