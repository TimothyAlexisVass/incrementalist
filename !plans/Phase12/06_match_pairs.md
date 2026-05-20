# Phase 12, Step 6: Match Pairs (One-Shot Result-Driven Memory Illusion)

## 1. Game Concept & Rules

**Match Pairs** is a one-shot, result-driven memory-style mini-game.

The server does **not** generate a real memory board.

The server does **not** store card positions.

The server does **not** care which visual tiles the player clicks.

The server only generates the ordered result array. The client then simulates the visual memory experience from that result.

---

## 2. Core Rules

1. The visual board is always a fixed set of 48 face-down tiles (6 rows, 8 columns).
2. The board is not generated with hidden pairs.
3. The server sends only the result array.
4. Each result entry represents exactly one player turn.
5. Each turn consists of exactly two card clicks.
6. Matching something does **not** grant extra turns.
7. The number of turns is exactly the length of the result array.
8. A `miss` creates no new reward opportunity.
9. A `match` creates one reward opportunity and includes the rolled tier.
10. If the player fails to complete a `match` opportunity, it becomes `discarded`.
11. A discarded match can be recovered on a later turn.
12. The final reward is based only on completed match opportunities (`rolled_matches - discarded`).
13. On the last turn, after the last click, the client visually flips over all remaining unmatched cards to reveal their positions as a console/concluding visual reward.
14. The game uses a two-step session-based interaction pattern (`action: "start"` and `action: "claim"`) to ensure the server validates and subtracts reported discarded tiers.

---

## 3. Server Result Contract

The server sends only this:

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

Nothing else.

No board size.

No board state.

No card positions.

No pair IDs.

No session metadata.

No mistake budget.

No hidden board.

---

## 4. Meaning of Result Entries

```text
:miss
```

Means:

```text
This turn creates no new reward opportunity.
The player may still recover an existing discarded match.
```

```text
{:match, tier}
```

Means:

```text
This turn creates one new reward opportunity with the given tier.
If the player completes it, they win that tier.
If they fail to complete it, it becomes discarded.
```

Example:

```elixir
{:match, :tier_4}
```

Means:

```text
This turn offers one tier_4 match opportunity.
```

---

## 5. Reward Tier Table

Each `match` result rolls its tier from the rarity table.

| Tier | Rarity | Chance | Reward ID |
| :---: | --- | :---: | --- |
| **1** | Common | `62.9581%` | `tier_1` |
| **2** | Uncommon | `25%` | `tier_2` |
| **3** | Rare | `8%` | `tier_3` |
| **4** | Excellent | `3%` | `tier_4` |
| **5** | Unique | `0.8%` | `tier_5` |
| **6** | Exotic | `0.2%` | `tier_6` |
| **7** | Ultimate | `0.0419%` | `tier_7` |

Critical detail:

```text
Every match opportunity includes its rolled tier.
```

So this is valid:

```elixir
{:match, :tier_3}
```

This is not:

```elixir
:match
```

---

## 6. Turn Count

The result array defines the full game length.

Example:

```elixir
[
  :miss,
  {:match, :tier_2},
  :miss,
  {:match, :tier_1}
]
```

This means:

```text
The game has exactly 4 turns.
```

Even if the player matches something, they do not gain extra turns.

Even if the player misses something, they do not lose extra turns.

The client consumes exactly one result entry per turn.

---

## 7. Client State

```ts
type ResultEntry =
  | { kind: "miss" }
  | { kind: "match"; tier: RewardTier }

type KnownCard = {
  symbol: string
  tier?: RewardTier
}

type Discarded = {
  symbol: string
  tier: RewardTier
}

const known: Record<number, KnownCard> = {}
const matched = new Set<number>()
const discarded: Discarded[] = []
const rewards: RewardTier[] = []

let nextSymbol = 0
```

Meaning:

```text
known      = visual cards the player has already seen
matched    = visual cards that stay face-up
discarded = match opportunities that were created but not completed
rewards    = completed reward tiers
```

---

## 8. Client Turn Logic

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
      rewards.push(firstCard.tier)
      removeDiscarded(firstCard.symbol)
    }

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

## 9. Reveal Logic

```ts
function reveal(index: number, entry: ResultEntry): KnownCard {
  if (known[index]) {
    return known[index]
  }

  const recovered = chooseDiscardedToRecover()

  if (recovered) {
    known[index] = {
      symbol: recovered.symbol,
      tier: recovered.tier
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

## 10. Discard Recovery Logic

```ts
function chooseDiscardedToRecover(): Discarded | null {
  if (discarded.length === 0) {
    return null
  }

  return discarded[0]
}
```

A discarded match can be recovered on a later turn by making a new visual card share the discarded symbol and tier.

Example:

```text
discarded contains:
{ symbol: "C", tier: "tier_2" }
```

Later, the player clicks a new card.

The client may reveal it as:

```text
C / tier_2
```

If the player then pairs it with the known `C`, the discarded match is completed.

---

## 11. Match Opportunity Behavior

When the current result entry is:

```ts
{ kind: "match", tier: "tier_4" }
```

The client must create one tier 4 reward opportunity during that turn.

If the player completes it:

```text
tier_4 is added to rewards
```

If the player fails it:

```text
tier_4 is added to discarded
```

If the player later recovers it:

```text
tier_4 is removed from discarded
tier_4 is added to rewards
```

---

## 12. Final Reward Calculation

```ts
const finalRewards = rewards
```

The player cannot receive more rewards than there are `match` entries in the server result.

Example:

```ts
const result = [
  { kind: "miss" },
  { kind: "match", tier: "tier_2" },
  { kind: "miss" },
  { kind: "match", tier: "tier_1" },
  { kind: "miss" },
  { kind: "match", tier: "tier_4" }
]
```

Maximum possible rewards:

```text
tier_2
tier_1
tier_4
```

Actual rewards:

```text
Only the completed match opportunities.
```

---

## 13. Backend Implementation

### File

```text
lib/incrementalist/game/features/bonustime/games/match_pairs.ex
```

### Backend Responsibility

The backend operates via a two-step active session:
1. **Start Game (`action: "start"`)**:
   - Spends the player's BonusTime token (or special token).
   - Generates the turn result array based on streak.
   - Stores the rolled results in the player's `active_session.data.results`.
   - Returns the result array to the client.
2. **Claim Rewards (`action: "claim"`)**:
   - Accepts the `discarded` tier list reported by the client (representing failed match opportunities).
   - Filters the original rolled results to subtract the reported `discarded` tiers (matching exact tier identities).
   - Grants the remaining completed matches as player rewards.
   - Clears the active session.

### Pseudocode

```elixir
def roll_reward_results(streak) do
  turn_count = calculate_turn_count(streak)

  Enum.map(1..turn_count, fn _ ->
    if match_opportunity?() do
      {:match, roll_tier()}
    else
      :miss
    end
  end)
end

def claim_reward(rolled_results, discarded_tiers, state, now) do
  # Filters the rolled matches and subtracts each exact reported discarded tier.
  # Grants remaining completed matches and returns the final reward summary.
end
```

---

## 14. Turn Count Formula

Read from `Constants.bonustime_game_rules()["match_pairs"]["turn_count"]`:

```elixir
def calculate_turn_count(streak) do
  rules = Constants.bonustime_game_rules()["match_pairs"]["turn_count"]
  rules["base"] + min(div(streak, rules["streak_divisor"]), rules["max_bonus"])
end
```

This gives:

```text
minimum turns: 4
maximum turns: 10
```

This is turn count, not mistake budget.

---

## 15. Tier Roll

Read from `Constants.bonustime_game_rules()["match_pairs"]["chances"]`:

```elixir
def roll_tier do
  chances = Constants.bonustime_game_rules()["match_pairs"]["chances"]
  roll = :rand.uniform()

  # Cumulative roll search
  # ...
end
```
```

---

## 16. Frontend Implementation

### Files

```text
assets/src/features/bonustime/match-pairs/
```

### Responsibilities

```text
result.ts          fetches the server result
simulation.ts      consumes result entries one turn at a time
view-model.ts      projects visual card states
render.ts          draws the fixed card grid
interactions.ts    handles player clicks
```

The frontend owns the visual illusion.

The backend owns the reward truth.

---

## 17. Testing

- Assert that the server returns only result entries.
- Assert that every `match` result includes a tier.
- Assert that `miss` results include no tier.
- Assert that the client consumes exactly one result entry per turn.
- Assert that matching does not add turns.
- Assert that missing does not remove turns.
- Assert that no board with precomputed pairs is generated.
- Assert that completed rewards can never exceed the number of `match` entries.
- Assert that discarded matches can be recovered.
- Assert that recovered matches keep their original tier.
- Assert that known visual cards keep their assigned symbol.
- Assert that matched visual cards remain face-up.
