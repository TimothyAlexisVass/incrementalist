# Critical
If you notice a repository convention or principle that is missing in this file, you MUST ask me about it and suggest adding it under the appropriate section – or suggest a new section for it – in this AGENTS.md file!

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

LocalStorage may be used only for harmless preferences.

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

Client messages send only command intent plus minimal visible UI intent required by that command.

The server owns command ids, idempotency, active save slot, queue order, replay state, and state versions.

Do not require the client to send command ids, active save slots, snapshot versions, state versions, or generic payload envelopes.

Every client command must receive a server result.

Server results must include the minimum required authoritative state for that command. They do not need to include a full snapshot every time.

`command.ack` means the client applied the current command result; it must not include a client-known command id. Cosmetic animations do not need to finish before ACK.

Use server snapshots when full state is required, such as boot or reconnect. Server results may include game-result events that the client can animate.

Client commands should describe player intent, not calculated results.

## Testing Expectations

Add backend rule tests for any gameplay logic moved or introduced.

Add frontend tests for protocol handling, projection state machines, and hit testing when practical.

For hidden-information features, especially Card Pick, add tests that prove unrevealed outcomes are never serialized to the client.

## Legacy Migration

Refer to `plans/migrate_from_legacy_to_canvas_elixir.md` before porting features.

Do not turn `legacy/game/game.js` into a new monolith. Port one feature at a time, keeping server rules and frontend presentation separate.

Use `legacy/` as the behavioral specification. Replace the legacy AI-slop structure with clean, best-practice architecture while preserving exact functionality.
