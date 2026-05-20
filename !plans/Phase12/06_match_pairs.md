# Phase 12, Step 6: Match Pairs (One-Shot Scripted Memory Game)

## 1. Game Concept & Rules

**Match Pairs** is an interactive memory-style mini-game where the server owns the reward truth up front, while the client simulates the memory board locally.

The player sees a grid of face-down tiles and attempts to match pairs. The board positions are not server-authored truth. The server only determines the ordered result script.

### Core Rules:
1. **The Board**: A fixed 48-tile visual grid.
2. **Server Result**: Before play begins, the server sends a one-shot result array.
3. **Result Entries**:
   - `miss`: no new match opportunity is created.
   - `match`: one new match opportunity is created and includes the rolled reward tier.
4. **Client Simulation**:
   - The client locally assigns symbols to clicked tiles as they are revealed.
   - Previously revealed tiles keep their assigned symbols.
   - Matched tiles remain face-up.
   - Mismatched tiles flip back face-down.
5. **Discarded Matches**:
   - If a `match` result occurs but the player fails to complete that match, the match opportunity is added to `discarded`.
   - A discarded match can be recovered later during a `miss` or `match` result if the player selects the relevant known card and a compatible tile.
6. **Reward Ceiling**:
   - The server result defines the maximum possible rewards.
   - The client can only reduce the final reward by leaving match opportunities in `discarded`.
7. **Completion**:
   - The game ends after the client consumes the full server result array.
   - Final reward is calculated from completed match opportunities.

---

## 2. Mathematical Formulas & Streak Scaling

- **Attempt Count / Result Length**: The number of scripted attempts scales with login streak:

  $$\text{attempts} = 4 + \min\left(\left\lfloor\frac{\text{streak}}{15}\right\rfloor, 6\right)$$

  - *Base attempts*: $4$.
  - *Streak bonus*: Adds up to $6$ additional attempts at streak 90+.
  - *Maximum attempts*: $10$.

- **Match Opportunity Rarity Table**:

  Each `match` entry rolls its reward tier according to these exact weights:

  | Tier | Pair Rarity | Chance per Match Opportunity | Placeholder Reward ID |
  | :---: | --- | :---: | --- |
  | **1** | Common | `62.9581%` | `tier_1` |
  | **2** | Uncommon | `25%` | `tier_2` |
  | **3** | Rare | `8%` | `tier_3` |
  | **4** | Excellent | `3%` | `tier_4` |
  | **5** | Unique | `0.8%` | `tier_5` |
  | **6** | Exotic | `0.2%` | `tier_6` |
  | **7** | Ultimate | `0.0419%` | `tier_7` |

---

## 3. Server Result Contract

The server sends only the result array.

No board size.
No board metadata.
No card positions.
No pair IDs.
No timestamps.
No session state.

### Example Result

```elixir
[
  :miss,
  {:match, :tier_2},
  :miss,
  {:match, :tier_1},
  :miss,
  {:match, :tier_4}
]
```

Meaning:

```text
attempt 1 = no new match opportunity
attempt 2 = new tier_2 match opportunity
attempt 3 = no new match opportunity, but recovery is possible
attempt 4 = new tier_1 match opportunity
attempt 5 = no new match opportunity, but recovery is possible
attempt 6 = new tier_4 match opportunity
```

---

## 4. UI Representation & Layout

The WebGL interface displays a clean card grid:

- **Grid Layout**: Fixed 48-tile layout, for example `6 × 8` or `8 × 6`.
- **Card States**:
  - *Hidden*: Drawn face-down.
  - *Flipped/Selected*: Rotates smoothly to show its assigned face symbol.
  - *Mismatch Shake*: Shakes side-to-side on mismatch before flipping back.
  - *Matched*: Remains face-up with reward styling.
- **HUD**:
  - Attempts remaining.
  - Matches completed.
  - Discarded match opportunities.

---

## 5. Client Simulation Model

The client owns the visual memory simulation.

### Client State

```ts
type ResultEntry =
  | { kind: "miss" }
  | { kind: "match"; tier: RewardTier }

type KnownCard = {
  symbol: string
  tier?: RewardTier
}

type DiscardedMatch = {
  symbol: string
  tier: RewardTier
}

const known: Record<number, KnownCard> = {}
const matched = new Set<number>()
const discarded: DiscardedMatch[] = []

let nextSymbol = 0
let completedRewards: RewardTier[] = []
```

### Core Meaning

```text
known      = cards the player has seen before
matched    = cards that are permanently completed
discarded = match opportunities that were granted but not completed
result     = server-owned reward truth
```

---

## 6. Client Play Logic

```ts
for (const entry of result) {
  const firstIndex = await playerClicksCard()
  const firstCard = reveal(firstIndex, entry)

  const secondIndex = await playerClicksCard()
  const secondCard = reveal(secondIndex, entry)

  if (firstCard.symbol === secondCard.symbol) {
    matched.add(firstIndex)
    matched.add(secondIndex)

    if (firstCard.tier) {
      completedRewards.push(firstCard.tier)
    }

    removeDiscarded(firstCard.symbol)

    keepFaceUp(firstIndex, secondIndex)
    continue
  }

  if (entry.kind === "match") {
    discarded.push({
      symbol: firstCard.symbol,
      tier: entry.tier
    })

    known[firstIndex] = {
      symbol: firstCard.symbol,
      tier: entry.tier
    }
  }

  shake(firstIndex, secondIndex)
  flipBack(firstIndex, secondIndex)
}
```

---

## 7. Reveal Logic

```ts
function reveal(index: number, entry: ResultEntry): KnownCard {
  if (known[index]) {
    return known[index]
  }

  const recoverable = chooseRecoverableDiscarded(entry)

  if (recoverable) {
    known[index] = {
      symbol: recoverable.symbol,
      tier: recoverable.tier
    }

    return known[index]
  }

  const symbol = createNextSymbol()

  known[index] = {
    symbol
  }

  return known[index]
}
```

---

## 8. Discard Recovery Logic

```ts
function chooseRecoverableDiscarded(entry: ResultEntry): DiscardedMatch | null {
  if (discarded.length === 0) {
    return null
  }

  // A miss creates no new reward, but may recover an existing discarded match.
  if (entry.kind === "miss") {
    return discarded[0]
  }

  // A match can either create a new match opportunity or recover an old one.
  // Prefer recovery if one exists.
  if (entry.kind === "match") {
    return discarded[0]
  }

  return null
}
```

---

## 9. Final Reward Calculation

```ts
const finalRewards = completedRewards
```

The server already capped the maximum possible reward by only sending the result array.

The client never creates rewards outside the server result.

A `match` entry can become:

```text
completed immediately
```

or:

```text
discarded
```

or:

```text
discarded first, recovered later
```

At the end, only completed rewards are awarded.

---

## 10. Elixir Backend

### File

```text
lib/incrementalist/game/features/bonustime/games/match_pairs.ex
```

### Responsibilities

The backend only generates the result.

It does not generate a board.
It does not track flips.
It does not store card positions.
It does not maintain a memory-game session.

### Pseudocode

```elixir
def start(streak) do
  attempt_count = 4 + min(div(streak, 15), 6)

  Enum.map(1..attempt_count, fn _ ->
    if match_opportunity?() do
      {:match, roll_tier()}
    else
      :miss
    end
  end)
end
```

### Tier Roll

```elixir
def roll_tier do
  roll = :rand.uniform()

  cond do
    roll <= 0.629581 -> :tier_1
    roll <= 0.879581 -> :tier_2
    roll <= 0.959581 -> :tier_3
    roll <= 0.989581 -> :tier_4
    roll <= 0.997581 -> :tier_5
    roll <= 0.999581 -> :tier_6
    true -> :tier_7
  end
end
```

---

## 11. TypeScript Frontend

### Files

```text
assets/src/features/bonustime/match-pairs/
```

### Responsibilities

- Request the one-shot result.
- Render the fixed 48-card board.
- Simulate card reveals.
- Track `known`, `matched`, and `discarded`.
- Recover discarded matches when possible.
- Calculate completed rewards after consuming the result.

### Suggested Files

```text
result.ts          # fetches server result
simulation.ts      # owns known/matched/discarded logic
view-model.ts      # projects cards for rendering
render.ts          # WebGL rendering
interactions.ts    # maps grid clicks to simulation actions
```

---

## 12. Verification & Testing

- Assert that the server returns only result entries.
- Assert that every `match` entry includes a reward tier.
- Assert that `miss` entries include no reward tier.
- Assert that the client cannot complete more rewards than there are `match` entries.
- Assert that discarded matches can be recovered.
- Assert that recovered discarded matches are removed from `discarded`.
- Assert that known cards keep their symbol after flipping back.
- Assert that matched cards remain face-up.
