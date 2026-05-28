# Critical
All date/time calculations must be done in UTC.
The client MUST synchronize its local clock with the server-provided `server_time` to account for drift and time zone differences; do not use raw `Date.now()` for authoritative countdowns or projections.

Offscreen workaround rendering is forbidden: do not introduce any kind of offscreen canvas/surface composition paths as a render shortcut!
No other canvas is allowed except #incrementalist, not even a temporary one.
ONLY Direct WebGL rendering to the #incrementalist canvas is allowed in this project.

If a repo convention or principle is missing here, ask about it and suggest where to add it.
NEVER STAGE CHANGES UNLESS EXPLICITLY ORDERED TO DO SO.

The game is under development and has not been deployed.
IT IS FORBIDDEN TO ADD BACKWARDS COMPATIBILITY!
RESET on conflict/breaking instead of adding compatibilty shims, versioning, etc...

NO FEATURE MAY EVER BLOCK PROGRESS BAR REWARD COLLECTION.
PROGRESS BAR REWARD COLLECTION MUST NEVER SWALLOW, CONSUME, OR BLOCK CLICKS INTENDED FOR OTHER UI INTERACTIONS.
WHEN `progress.claim_reward` RETURNS `claim_not_ready`, CLIENT CLAIM RESOLUTION MUST KEEP WAITING/RETRYING (USING `can_claim_in`) UNTIL A NON-ERROR RESULT ARRIVES; DO NOT REPLACE THIS WITH A ONE-SHOT CALL PLUS VERIFY LOOP BOUNCE.
DO NOT EXIT PENDING CLAIM RESOLUTION EARLY: KEEP THE BAR VISUALLY AT 0% DURING THIS WAIT WINDOW.

Edits of .ts files have to pass tsc --noEmit checks.

# STRICT NON-NEGOTIABLE OBEDIENCE RULES
* IF I ASK YOU A QUESTION THAT DOESN'T IMPLY THAT YOU SHOULD CHANGE CODE => DO NOT CHANGE CODE
* NEVER SCOPE CREEP! IF I MENTION 4 FILES => DO NOT CHANGE 5 FILES!
* DO NOT MAKE ASSUMPTIONS: IF YOU ARE UNSURE ABOUT ANYTHING, ASK ME!
* DO EXACTLY WHAT YOU ARE TOLD AND NOTHING MORE. YOU CAN SUGGEST TO DO MORE, BUT ONLY DO IT IF I AGREE!
* DON'T BLOAT YOUR RESPONSES!
* LATEX DOES NOT RENDER IN THE CHAT. USE PLAIN TEXT OR STANDARD MARKDOWN CODE BLOCKS INSTEAD.

## Migration Hygiene
Keep migrations free of middle states. Do not leave create -> alter -> drop, add -> remove, or create -> update chains in `priv/repo/migrations/`; update existing migrations instead, then run `mix ecto.reset && MIX_ENV=test mix ecto.reset`.

## Core Rule
The server owns truth. The client owns projection, rendering, input, and reversible UI state.

## Forbidden Client Authority
Client-side truth is forbidden for reward grants, claim eligibility, purchases, unlocks, level-ups, quest completion, achievement completion, daily bonus outcomes, gameplay RNG, hidden card or board outcomes, and durable save state. LocalStorage may only hold harmless preferences, anonymous identity tokens, and non-authoritative cached gameplay snapshots. It must never store command ids, queue position, reward eligibility, hidden outcomes, or anything that can authorize durable gameplay transitions.

## Hidden outcomes Contract (Showing Card pick Bonus game as example)
The client must never receive hidden outcomes. Store selected indexes as UI intent only. The server validates the picked count against server-owned session phase and calculates reveal outcomes only when the reveal command is processed. Snapshots and responses may include only information the player is allowed to know.

## Architecture Rules
Backend game code lives under `lib/incrementalist/game/` and is split into data, rules, commands, sessions, snapshots, and persistence. Frontend game code lives under `assets/src/` and is split into core, net, render, ui, features, and theme. Keep frontend source and generated static assets in sync by rebuilding from `assets/` with `npm run build` after editing frontend source or theme files. Do not hand-edit generated static assets without the matching source change. The game UI is Canvas/WebGL; HTML may only host the canvas and non-game shell. Temporary HTML gameplay controls are bootstrap-only and must be replaced when the Canvas surface exists.

```txt
feature/
  view-model.ts
  render.ts
  interactions.ts
```

`render.ts` draws only. `interactions.ts` converts hit tests to command intents. `view-model.ts` derives renderable data from server snapshots.

## Persistence Rules
Use `player_states` with `jsonb` game state. Each player has exactly one game state row. Use a `game_commands` table for idempotent command processing and auditability. During development, prefer resetting data and updating the current schema over adding backward-compatibility layers or preserving old save formats. Avoid over-normalizing gameplay state unless a stable query or integrity need justifies it.
Keep server-owned save-state coherent with the embedded-schema pattern: persist authoritative gameplay state as `Ecto.Schema` embeds, keep nested state as nested embeds rather than ad hoc maps, and project wire/client payloads from those structs. Use maps only at serialization/projection boundaries; do not keep parallel map-shaped and struct-shaped save-state models in application code.

## PlayerServer / DB Rules
`Incrementalist.Game.Session.PlayerServer` is the single authority for live per-player command flow. Do not move hot-path command sequencing back into DB locks or transactional queue mutation.

Execution and queue rules:
- Accept, dedupe, queue, execute, replay, and ACK-gating for live commands inside `PlayerServer`.
- Keep FIFO order in `PlayerServer` in-memory state.
- Never re-execute a completed command because of reconnect or missing ACK; replay the stored result instead.
- Preserve save-boundary blocking behavior (`game.reset`) in the `PlayerServer` flow.

Persistence boundary rules:
- Treat `player_states` as critical durable state and persist synchronously at required boundaries (disconnect, idle timeout shutdown, game reset, process termination).
- Treat `game_commands` as command log/audit persistence that follows execution; it must not be the coordination primitive for live ordering.
- Do not introduce `FOR UPDATE`/row-lock serialized gameplay command execution paths.
- Keep DB writes aligned with server truth: save-state durability is authoritative; command rows support replay/audit semantics.

## Constants Rule
Do not introduce backend gameplay magic numbers inline. Shared server-owned limits, thresholds, queue sizes, timers, and other domain constants must live in `lib/incrementalist/game/constants.ex` and be referenced from there. Frontend presentation-only constants may live in `assets/src/config.ts` or nearby feature files, but they must mirror server-owned rules rather than invent their own authoritative values.

## BigNum and High-Precision Math Rule
Gameplay values that can exceed standard double-precision float limits (EXP, coins, shards, cores, sisu, required_exp, multipliers) MUST use the high-precision `BigNum` representation (`{m, e}` where `1 <= abs(m) < 10`). 
- **Persistence & Wire**: Persist `BigNum` fields as `embeds_one` in Ecto schemas. They serialize natively to JSON objects (`{"m": 1.5, "e": 10}`).
- **Operations**: Never use raw mathematical operators (`+`, `-`, `*`, `/`) directly on `BigNum` objects or struct fields. Always use the provided math libraries (`lib/incrementalist/game/big_num.ex` and `assets/src/core/bignum.ts`). These functions enforce normalization, handle zero edge-cases, and optimize with early returns for massive exponent differences.
- **Presentation**: Use the dual-mode formatting system in `assets/src/format.ts` to convert `BigNum` instances into human-readable suffixed strings or scientific notation. Do not write ad-hoc formatting logic in UI features.

## Client/Server Protocol Rules
Durable gameplay communication is client command, server result. Allowed server push events are non-durable projection/synchronization events only (`player.tick`, `session.superseded`). Push events are never ACKed and must never execute durable gameplay transitions. Client commands describe player intent, include only a client-generated integer `command_id`, and omit UI display details. The client command ids are the indexes of a 10-slot local boolean queue and must not be stored in LocalStorage. The server owns durable command sequencing, idempotent execution, FIFO queue order, replay state, and persisted command results until ACK. Do not require version markers or generic payload envelopes from the client. Cache hints are allowed only to reduce snapshot payload size.

Every client command must receive a server result. Server results should include only the minimum authoritative values needed for that command and must not include UI instructions, animation directives, popup semantics, layout anchors, or presentation-only events. Do not add speculative bookkeeping fields. Protocol types must be discriminated unions keyed by `type`. Queue acceptance returns `command.queued` with only `command_id`; queue acceptance, queue rejection, and ACK responses are not ACKed. Error reasons must be machine-readable fields on explicit error result types. `command.ack` carries only the applied client `command_id`. Use server snapshots for boot or reconnect, and prefer cached client snapshots for boot when visible state already exists. Canonical push-event wire contracts live in `shared/protocol/game-push.md`; this AGENTS file is the summary.

## State Synchronization Rule
When handling command results on the client, always use the centralized `applyAuthoritativeData(state, result)` handler in `assets/src/net/snapshots.ts` instead of writing ad-hoc inline mutations. This ensures all server-provided authoritative values (like `level`, `exp`, `coins`, `shards`, `cores`) are safely and consistently merged into the local snapshot across the entire application without duplicated logic. Do not add inline state mutations in feature modules when applying server results.

## Dynamic Text Update Rule
For Canvas/WebGL text that changes over time, do not swap text directly in ad-hoc ways that can cause one-frame disappearance/flicker while glyphs sync. Use the centralized updater `resolveUpdatingText` with renderer readiness checks (`renderer.isTextReady(...)`) so displayed text only changes when the next value is render-ready.

## Testing Expectations
Add backend rule tests for any gameplay logic moved or introduced. Add frontend tests for protocol handling, projection state machines, and hit testing when practical. For hidden-information features, especially Card Pick, add tests that prove unrevealed outcomes are never serialized to the client.
