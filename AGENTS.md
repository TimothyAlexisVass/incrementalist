# Critical
If a repo convention or principle is missing here, ask about it and suggest where to add it.
NEVER STAGE CHANGES UNLESS EXPLICITLY ORDERED TO DO SO.

The game is under development and has not been deployed.
IT IS FORBIDDEN TO ADD BACKWARDS COMPATIBILITY!
RESET on conflict/breaking instead of adding compatibilty shims, versioning, etc...

NO FEATURE MAY EVER BLOCK PROGRESS BAR REWARD COLLECTION.
PROGRESS BAR REWARD COLLECTION MUST NEVER SWALLOW, CONSUME, OR BLOCK CLICKS INTENDED FOR OTHER UI INTERACTIONS.

Edits of .ts files have to pass tsc --noEmit checks.

## Migration Hygiene
Keep migrations free of middle states. Do not leave create -> alter -> drop, add -> remove, or create -> update chains in `priv/repo/migrations/`; update existing migrations instead, then run `mix ecto.reset && MIX_ENV=test mix ecto.reset`.

## Core Rule
The server owns truth. The client owns projection, rendering, input, and reversible UI state.

## Forbidden Client Authority
Client-side truth is forbidden for reward grants, claim eligibility, purchases, unlocks, level-ups, quest completion, achievement completion, daily bonus outcomes, gameplay RNG, hidden card or board outcomes, and durable save state. LocalStorage may only hold harmless preferences, anonymous identity tokens, and non-authoritative cached gameplay snapshots. It must never store command ids, queue position, reward eligibility, hidden outcomes, or anything that can authorize durable gameplay transitions.
Legacy client-local save-file code remains only as migration reference under `legacy/`; do not extend that model into the active `assets/src/` client.

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
Use `save_slots` with `jsonb` game state. Players have 4 save slots. Use a `game_commands` table for idempotent command processing and auditability. During development, prefer resetting data and updating the current schema over adding backward-compatibility layers or preserving old save formats. Avoid over-normalizing gameplay state unless a stable query or integrity need justifies it.
Keep server-owned save-state coherent with the embedded-schema pattern: persist authoritative gameplay state as `Ecto.Schema` embeds, keep nested state as nested embeds rather than ad hoc maps, and project wire/client payloads from those structs. Use maps only at serialization/projection boundaries; do not keep parallel map-shaped and struct-shaped save-state models in application code.

## PlayerServer / DB Rules
`Incrementalist.Game.Session.PlayerServer` is the single authority for live per-player command flow. Do not move hot-path command sequencing back into DB locks or transactional queue mutation.

Execution and queue rules:
- Accept, dedupe, queue, execute, replay, and ACK-gating for live commands inside `PlayerServer`.
- Keep FIFO order in `PlayerServer` in-memory state.
- Never re-execute a completed command because of reconnect or missing ACK; replay the stored result instead.
- Preserve save-boundary blocking behavior (`save_slot.switch`, `save_slot.reset`) in the `PlayerServer` flow.

Persistence boundary rules:
- Treat `save_slots` as critical durable state and persist synchronously at required boundaries (disconnect, idle timeout shutdown, slot switch/reset, process termination).
- Treat `game_commands` as command log/audit persistence that follows execution; it must not be the coordination primitive for live ordering.
- Do not introduce `FOR UPDATE`/row-lock serialized gameplay command execution paths.
- Keep DB writes aligned with server truth: save-state durability is authoritative; command rows support replay/audit semantics.

## Constants Rule
Do not introduce backend gameplay magic numbers inline. Shared server-owned limits, thresholds, slot counts, queue sizes, timers, and other domain constants must live in `lib/incrementalist/game/constants.ex` and be referenced from there. Frontend presentation-only constants may live in `assets/src/config.ts` or nearby feature files, but they must mirror server-owned rules rather than invent their own authoritative values.

## BigNum and High-Precision Math Rule
Gameplay values that can exceed standard double-precision float limits (EXP, coins, shards, cores, sisu, required_exp, multipliers) MUST use the high-precision `BigNum` representation (`{m, e}` where `1 <= abs(m) < 10`). 
- **Persistence & Wire**: Persist `BigNum` fields as `embeds_one` in Ecto schemas. They serialize natively to JSON objects (`{"m": 1.5, "e": 10}`).
- **Operations**: Never use raw mathematical operators (`+`, `-`, `*`, `/`) directly on `BigNum` objects or struct fields. Always use the provided math libraries (`lib/incrementalist/game/big_num.ex` and `assets/src/core/bignum.ts`). These functions enforce normalization, handle zero edge-cases, and optimize with early returns for massive exponent differences.
- **Presentation**: Use the dual-mode formatting system in `assets/src/format.ts` to convert `BigNum` instances into human-readable suffixed strings or scientific notation. Do not write ad-hoc formatting logic in UI features.

## Client/Server Protocol Rules
The only gameplay communication pattern is client command, server result. Client commands describe player intent, include only a client-generated integer `command_id`, and omit UI display details. The client command ids are the indexes of a 10-slot local boolean queue and must not be stored in LocalStorage. The server owns durable command sequencing, idempotent execution, active save slot, FIFO queue order, replay state, and persisted command results until ACK. Do not require active save slots, version markers, or generic payload envelopes from the client. Cache hints are allowed only to reduce snapshot payload size.

Every client command must receive a server result. Server results should include only the minimum authoritative values needed for that command and must not include UI instructions, animation directives, popup semantics, layout anchors, or presentation-only events. Do not add speculative bookkeeping fields. Protocol types must be discriminated unions keyed by `type`. Queue acceptance returns `command.queued` with only `command_id`; queue acceptance, queue rejection, and ACK responses are not ACKed. Error reasons must be machine-readable fields on explicit error result types. `command.ack` carries only the applied client `command_id`. Use server snapshots for boot or reconnect, and prefer cached client snapshots for boot or save-slot loading when visible state already exists.

## State Synchronization Rule
When handling command results on the client, always use the centralized `applyAuthoritativeData(state, result)` handler in `assets/src/net/snapshots.ts` instead of writing ad-hoc inline mutations. This ensures all server-provided authoritative values (like `level`, `exp`, `coins`, `shards`, `cores`) are safely and consistently merged into the local snapshot across the entire application without duplicated logic. Do not add inline state mutations in feature modules when applying server results.

## Testing Expectations
Add backend rule tests for any gameplay logic moved or introduced. Add frontend tests for protocol handling, projection state machines, and hit testing when practical. For hidden-information features, especially Card Pick, add tests that prove unrevealed outcomes are never serialized to the client.

## Legacy Migration
Refer to `plans/migrate_from_legacy_to_canvas_elixir.md` before porting features. Do not turn `legacy/game/game.js` into a new monolith. Port one feature at a time, keeping server rules and frontend presentation separate. Use `legacy/` as the behavioral specification and preserve exact player-visible functionality.
