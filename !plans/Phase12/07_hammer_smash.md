# Phase 12, Step 7: Hammer Smash — Tivoli High Striker

## 1. Game Concept & Rules

**Hammer Smash** is a deterministic, single-shot high-striker reveal. The player spends one daily-bonus token to start a server-authoritative resolution, and the client then replays the full meter-and-pole animation from that stored result.

### Core Rules

1. Spending a token starts one server-authoritative Hammer Smash resolution.
2. The server precomputes all three normal smashes in one roll.
3. The client replays the meter sweep, hammer strikes, and pole rise from the stored result.
4. The base reward comes from the combined power of the three normal smashes.
5. If the combined power reaches the bell threshold, the player receives `tier_6` plus one extra bell-break reveal.
6. The extra bell-break smash is precomputed as part of the same resolution.
7. There is no repeated `submit_smash()` loop and no client-side reward authority.

---

## 2. Deterministic Strike Math & Streak Scaling

Each Hammer Smash play consists of **three numeric smash powers**.

```elixir
smash_1_power = roll_smash_power(streak)
smash_2_power = roll_smash_power(streak)
smash_3_power = roll_smash_power(streak)

total_smash_power = smash_1_power + smash_2_power + smash_3_power
```

Each smash power is an integer from `min_smash_power` to `100`.

### Streak Bonus

The login streak increases the minimum possible smash power.

```elixir
min_smash_power = 1 + min(streak * 0.21, 100)
```

* At streak `0`, smash power rolls from `1` to `100`.
* At streak `100+`, smash power rolls from `22` to `100`.
* The streak bonus caps at `100` days.
* The max streak bonus doubles the chance of hitting the bell.

---

## 3. Base Reward Table

The base reward is determined by `total_smash_power`.

```elixir
total_smash_power = smash_1_power + smash_2_power + smash_3_power
```

| Total Smash Power | Reward Tier                                | Description / Milestone |
| :---------------: | ------------------------------------------ | ----------------------- |
|    `3` to `131`   | `tier_1`                                   | Weak strike             |
|   `132` to `164`  | `tier_2`                                   | Low strike              |
|   `165` to `195`  | `tier_3`                                   | Average strike          |
|   `196` to `217`  | `tier_4`                                   | Solid strike            |
|   `218` to `239`  | `tier_5`                                   | Strong strike           |
|   `240` to `262`  | `tier_6`                                   | Elite strike            |
|   `263` to `300`  | `tier_6` + `"Smash the Bell"` extra reveal | Bell hit                |

### Baseline Outcome Distribution

At streak `0`, where each smash power rolls from `1` to `100`, the reward table gives approximately:

| Outcome         |   Chance |
| --------------- | -------: |
| `tier_1`        | `35.27%` |
| `tier_2`        | `24.41%` |
| `tier_3`        | `20.48%` |
| `tier_4`        |  `9.96%` |
| `tier_5`        |  `5.91%` |
| `tier_6`        |  `2.98%` |
| `tier_6` + bell |  `0.99%` |

This matches the intended baseline distribution:

* `35%` for `tier_1`
* `25%` for `tier_2`
* `20%` for `tier_3`
* `10%` for `tier_4`
* `6%` for `tier_5`
* `3%` for `tier_6`
* `1%` for `tier_6` + bell

At streak `100+`, the bell chance becomes approximately `2%`.

HOWEVER!!!! In the UI, 263 is the top of the tower and that is presented as 1000
So, to the player the number that is presented as 1-100 is 4 to 380 (the height player gets to is rounded to be an integer)

Example:
first smash, player gets 100, looks like 380
second smash, player gets 37 (total is now 137) => looks like round(1000/263 * 137) = 521
third smash, player gets 74 (total is now 211) => looks like round(1000/263 * 211) = 802

---

## 4. Bell-Break Extra Reward

If `total_smash_power >= 263` (which would be >= 1000 in the UI), the bell is hit.

When the bell is hit, the server also rolls one extra smash power as part of the same resolution:

```elixir
extra_smash_power = roll_smash_power(streak)
```

The extra smash determines the bell-break reward.

| Extra Smash Power | Bell Shatter Outcome    | Extra Reward Tier |
| :---------------: | ----------------------- | :---------------: |
|    `1` to `49`    | Bell cracks             |      `tier_4`     |
|    `50` to `74`   | Bell cracks a lot       |      `tier_5`     |
|    `75` to `90`   | Bell breaks             |      `tier_6`     |
|   `91` to `100`   | Bell shatters perfectly |      `tier_7`     |

The extra smash is not a second paid play. It is part of the original Hammer Smash result.

---

## 5. UI Representation & Layout

Hammer Smash is visually based on classic carnival high-striker games.

### Striker Pole

A tall vertical striker tower with a bell at the top.

### Sweeping Power Bar

The power bar displays the currently revealed smash power.

* The meter sweeps between 1% and `100%`.
* The authoritative result is already known by the server.
* The animation only replays the stored result.
* When the user clicks "SMASH!" the meter slows down, continuing to go back and forth a random number of times between 1 and 4, until settling at the known smash_n_power.

### Smash Sequence

The client replays:

1. First hammer strike using `smash_1_power`
2. Second hammer strike using `smash_2_power`
3. Third hammer strike using `smash_3_power`
4. Final pole rise based on `total_smash_power`
5. Bell-hit sequence if `total_smash_power >= 263`
6. Extra bell-break reveal if the bell was hit

---

## 6. Implementation Details

### Elixir Backend

File:

```text
lib/incrementalist/game/features/bonustime/games/hammer_smash.ex
```

### Roll Function

```elixir
roll_reward(streak)
```

Returns the full Hammer Smash result in one shot.

### Server Roll Logic

```elixir
defp min_smash_power(streak) do
  1 + floor(min(streak, 100) * 21 / 100)
end

defp roll_smash_power(streak) do
  min_power = min_smash_power(streak)
  Enum.random(min_power..100)
end

defp reward_for_total_power(total_smash_power) do
  cond do
    total_smash_power >= 263 -> {:tier_6, :bell}
    total_smash_power >= 240 -> {:tier_6, nil}
    total_smash_power >= 218 -> {:tier_5, nil}
    total_smash_power >= 196 -> {:tier_4, nil}
    total_smash_power >= 165 -> {:tier_3, nil}
    total_smash_power >= 132 -> {:tier_2, nil}
    true -> {:tier_1, nil}
  end
end

defp bell_reward_for_extra_power(extra_smash_power) do
  cond do
    extra_smash_power >= 91 -> :tier_7
    extra_smash_power >= 75 -> :tier_6
    extra_smash_power >= 50 -> :tier_5
    true -> :tier_4
  end
end
```

### Returned Payload

The result should include:

```elixir
%{
  smash_1_power: first smash power,
  smash_2_power: second smash power,
  smash_3_power: third smash power,
  extra_smash_power: extra smash power (or nil)
}
```

The `extra_smash_power` is only present when the bell is hit.

---


### `render.ts`

Handles WebGL Canvas rendering:

* Power meter sweep
* Hammer strike animation
* Ball rise animation
* Pole height visualization
* Bell impact animation
* Bell crack/break/shatter particles
* Extra bell-break reveal animation

### `interactions.ts`

Handles player input:

* Clicking `Smash` starts the single reveal flow.
* Cosmetic stance or timing-flavor inputs do not affect rewards.
* The client never submits individual smash timing to the server.

---

## 8. Verification & Testing

### Backend Tests

Assert that:

1. `min_smash_power(0) == 1`
2. `min_smash_power(100) == 22`
3. `min_smash_power(190) == 22`
4. Each normal smash power is between `min_smash_power` and `100`
5. `total_smash_power` equals the sum of the three normal smashes
6. `tier_1` is awarded for totals `3..131`
7. `tier_2` is awarded for totals `132..164`
8. `tier_3` is awarded for totals `165..195`
9. `tier_4` is awarded for totals `196..217`
10. `tier_5` is awarded for totals `218..239`
11. `tier_6` is awarded for totals `240..262`
12. Bell hit is awarded for totals `263..300`
13. Bell-hit results include `extra_smash_power`
14. Non-bell results do not include `extra_smash_power`
15. Cosmetic inputs do not affect the authoritative reward

### Distribution Tests

Run a large simulation and verify that streak `0` is close to:

| Outcome         | Expected Chance |
| --------------- | --------------: |
| `tier_1`        |           `35%` |
| `tier_2`        |           `25%` |
| `tier_3`        |           `20%` |
| `tier_4`        |           `10%` |
| `tier_5`        |            `6%` |
| `tier_6`        |            `3%` |
| `tier_6` + bell |            `1%` |

Also verify that streak `100+` approximately doubles the `tier_6` + bell chance to `2%`.
