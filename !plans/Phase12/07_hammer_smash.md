# Phase 12, Step 7: Hammer Smash (Tivoli High Striker)

## 1. Game Concept & Rules

**Hammer Smash** is a deterministic, single-shot high-striker reveal. The player spends one daily-bonus token to start a server-authoritative resolution, and the client then replays the full meter-and-pole animation from that result.

If the UI keeps `Safe`, `Balanced`, or `Wild` prompts, they are cosmetic only. They create the illusion of choice, but they must not change the reward math or the bell-break outcome.

### Core Rules:
1. Spending a token starts one server-authoritative striker resolution.
2. The server precomputes both normal smashes and the optional bell-break smash in one shot.
3. The client replays the meter sweep and pole rise from the stored result.
4. The base reward comes from the final pole height after the two normal smashes.
5. Hitting the bell grants `tier_6` plus one extra bell-break reveal.
6. The extra smash outcome is part of the same resolution, not a second play command.

---

## 2. Deterministic Strike Math & Streak Scaling

- **Minimum Meter Floor**: The login streak raises the lower bound of the moving power sweep, clamping worst-case timing:
  $$\text{min\_amount} = 5 + \min\left(\frac{\text{streak}}{15}, 15\right)\%$$
  - *Base floor*: `5%`.
  - *Streak cap*: Max `20%` minimum power floor (achieved at streak 225+).
- **Pole Height Reward Table**:
  The final pole height after the two normal smashes maps to these baseline rewards:

  | Pole Height | Reward Tier | Description / Milestone |
  | :---: | --- | --- |
  | `0%` to `<15%` | `tier_1` | Weak strike |
  | `15%` to `<30%` | `tier_2` | Low strike |
  | `30%` to `<60%` | `tier_3` | Average strike |
  | `60%` to `<75%` | `tier_4` | Solid strike |
  | `75%` to `<90%` | `tier_5` | Strong strike |
  | `90%` to `<100%` | `tier_6` | Elite strike |
  | `100%` (Bell hit) | `tier_6` + "Smash the Bell" extra reveal | Perfect bell-strike milestone |

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
- **Cosmetic Choice Layer**: Optional `Safe`, `Balanced`, and `Wild` buttons can change the look of the animation, but not the result.
- **Replay Markers**: Draw a marker for the precomputed strike position and a second marker for the final server-calculated bell-break result if present.
- **Ascending Ball**: A metal indicator ball slides up the vertical pole following the stored smash result.
- **Destruction Particles**: Splinters and shatter particles burst from the bell on perfect hits.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/hammer_smash.ex`)
- **Roll Function**: `roll_reward(streak)` returns the full smash sequence in one shot.
- **Returned Data**: The payload should include `smash_1_power`, `smash_2_power`, `pole_height`, and `extra_smash_power` when the bell is hit.
- **Single Resolution**: There is no repeated `submit_smash()` loop, no live meter authority on the client, and no follow-up command for the extra smash.
- **Reward Mapping**: The base tier comes from the final pole height, and the bell-break tier is derived from the extra smash power when applicable.
- **Cosmetic Inputs**: Any stance or timing-flavor input is used only for presentation, not for reward generation.

### TypeScript Frontend (`assets/src/features/bonustime/hammer-smash/`)
- **`view-model.ts`**: Projects the precomputed smash powers, pole height, and optional bell-break tier into renderable state.
- **`render.ts`**: WebGL Canvas rendering. Replays the meter sweep, rises the striker ball, and triggers bell cracking or shattering particles.
- **`interactions.ts`**: Clicking `Smash` starts the single reveal flow; any stance buttons are cosmetic only.

---

## 5. Verification & Testing
- Assert that the streak correctly raises the meter floor limit.
- Test that one play result always includes the two normal smash powers and the final pole height.
- Verify that bell-hit runs return the extra smash payload and bonus tier in the same result.
- Confirm that cosmetic stance selection does not change the authoritative reward.
