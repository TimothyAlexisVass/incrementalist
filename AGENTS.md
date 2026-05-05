# Critical
If you notice a repository convention or principle that is missing in this file, you MUST ask me about it and suggest adding it under the appropriate section – or suggest a new section for it – in this AGENTS.md file!

NEVER STAGE CHANGES UNLESS EXPLICITLY ORDERED TO DO SO.

## Project description

Server-authoritative incremental game built with Elixir/Phoenix/Postgres and an HTML5 Canvas/WebGL frontend.

The `legacy/` directory is a prototype reference, not the desired architecture.

The new game must match the legacy game's functionality exactly. Change the code organization, authority model, and implementation quality, not the player-visible behavior, rules, save-slot model, or feature set unless explicitly ordered to do so.

## Core Rule

The server owns truth. The client owns projection, rendering, input, and reversible UI state.

Client code may project values for display, such as progress bar fill, only from server-issued snapshot data. The client must not authorize durable state transitions.

## Forbidden Client Authority

Do not implement client-side truth for:

- Reward grants.
- Claim eligibility.
- Purchases.
- Unlocks.
- Level-ups.
- Quest completion.
- Achievement completion.
- Daily bonus outcomes.
- Gameplay RNG.
- Hidden card or board outcomes.
- Durable save state.

LocalStorage may store harmless preferences, server-issued anonymous identity tokens, and non-authoritative cached gameplay snapshots for each save slot.
Cached gameplay snapshots are a rendering/startup optimization only. They may be used to draw immediately after boot or slot switch, but any server snapshot or command result overwrites them.
LocalStorage must never store command ids, server queue position, reward eligibility, hidden outcomes, or any value the client can use to authorize durable gameplay transitions.

## Progress Bar Contract

The client may calculate projected progress fill for display. When projected fill reaches full, the client must ask the server to verify.

Required flow:

1. Client projects fill from server snapshot data.
2. Client reaches projected full and enters a loading/verifying state.
3. Client sends a verify command.
4. Server lazily advances progress to server now.
5. Server either confirms collectibility or returns a corrected snapshot.
6. Client shows the full burst and `ACT!` only after server confirmation.

The server should not tick every frame. Prefer lazy advancement on commands, boot, reconnect, sync, and verify.

## Hidden outcomes Contract (Showing Card pick Bonus game as example)

The client must never receive hidden outcomes.
Example: The card pick bonus game has 36 hidden cards. The player perceives it as if they are selecting cards from a pre-calculated set. Instead what happens is that the client tells the server the picked count at reveal time, and the server calculates 36 results. The first X results are the picked cards, and the rest are the "missed cards".

The client may store selected indexes as UI intent only. The server does not receive or store selected indexes. The server validates the picked count against the server-owned session phase and calculates reveal outcomes only when the reveal command is processed.

Snapshots and responses must include only information the player is allowed to know.

## Architecture Guidance

Backend game code must live under `lib/incrementalist/game/` and be split into data, rules, commands, sessions, snapshots, and persistence.

Frontend game code must live under `assets/src/` and be split into core, net, render, ui, features, and theme.

Frontend source and generated static assets must stay in sync. When editing frontend source or theme files under `assets/src/`, rebuild from `assets/` with `npm run build` so `priv/static/assets/app.js` and `priv/static/assets/app.css` match the source. Do not hand-edit generated static assets unless the matching source change is also made.

The game UI is Canvas/WebGL. HTML elements may host the canvas and non-game browser shell only. Do not build gameplay display, menus, overlays, buttons, hit testing, hover state, or modal-like flows as DOM UI.

Temporary HTML gameplay controls may exist only as bootstrap scaffolding before the matching Canvas surface is ported. Do not extend or build new gameplay functionality on top of that scaffolding. When the Canvas surface for that feature is introduced, replace the temporary DOM controls.

For frontend features, prefer this shape:

```txt
feature/
  view-model.ts
  render.ts
  interactions.ts
```

`render.ts` draws only. `interactions.ts` converts hit tests to command intents. `view-model.ts` derives renderable data from server snapshots.

## Persistence Guidance

Prefer `save_slots` with versioned `jsonb` game state while rules are still evolving.

Anonymous players should have 4 save slots.

Use a `game_commands` table for idempotent command processing and auditability.

Avoid over-normalizing gameplay state early unless a stable query or integrity need justifies a relational table.

## Protocol Guidance

The only gameplay communication pattern is: client sends a command, server sends a result.

Client messages send only command intent, a client-generated integer `command_id`, and minimal visible UI intent required by that command.

Client command ids are the indexes of a 10-slot local boolean queue: `true` means waiting for the authoritative result, `false` means not waiting for that result.
Client command ids exist only to pair a queued command/result/ACK with the client's local transport queue slot. They are not durable gameplay authority and must not be stored in LocalStorage.

The server owns durable command sequencing, idempotent execution, active save slot, FIFO queue order, and replay state.
The server persists command results and replays those results until ACK instead of re-running game rules.

Do not require the client to send active save slots, version markers, or generic payload envelopes.
The client may send cache-presence hints, such as which save slots have cached snapshots, only to reduce snapshot payload size. Cache hints must never be treated as authoritative state.

Every client command must receive a server result.

Server results must include the minimum required authoritative state for that command. They do not need to include a full snapshot every time.

Do not add speculative bookkeeping fields, counters, versions, audit metadata, or "might be useful later" values. Every persisted field and every protocol field must support a concrete current behavior, invariant, or query. If it does not, leave it out.

Protocol types must be exact discriminated unions keyed by `type`. Do not model server results as one generic object with optional fields for unrelated variants. A field belongs only on the result type that actually sends it.

ACK-ability is part of the command queue contract, not a generic optional boolean. A processed queued command result is ACKed. Queue acceptance, queue rejection, and ACK responses are not themselves ACKed.
Queue acceptance returns `command.queued` with only `command_id`; it must not expose command type or queue position.

Error reasons must be machine-readable fields on explicit error result types, not optional text on every result.

Follow-on command results released by `command.ack` must be named by what happened at the queue boundary, such as `released_result`, not vague transport wording like `next_result`.

`command.ack` means the client applied the current command result; its payload is only the applied client `command_id`. Cosmetic animations do not need to finish before ACK.

Use server snapshots when full state is required, such as boot or reconnect. Server results may include game-result events that the client can animate.

Prefer using cached client snapshots for boot or save-slot loading when the client already has visible state for that slot. If the cached state is stale, later authoritative command results overwrite it.

Client commands should describe player intent, not calculated results.

## Testing Expectations

Add backend rule tests for any gameplay logic moved or introduced.

Add frontend tests for protocol handling, projection state machines, and hit testing when practical.

For hidden-information features, especially Card Pick, add tests that prove unrevealed outcomes are never serialized to the client.

## Legacy Migration

Refer to `plans/migrate_from_legacy_to_canvas_elixir.md` before porting features.

Do not turn `legacy/game/game.js` into a new monolith. Port one feature at a time, keeping server rules and frontend presentation separate.

Use `legacy/` as the behavioral specification. Replace the legacy AI-slop structure with clean, best-practice architecture while preserving exact functionality.
