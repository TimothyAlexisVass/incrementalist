# Game Push Protocol

## Scope
This document defines non-durable server push events for the game channel.

Durable gameplay transitions must still use client command -> server result.

## Player Tick
Event name: `player.tick`

Payload:
- `type`: `"player.tick"`
- `server_time`: ISO8601 UTC timestamp
- `climate`: full visible climate payload
- `soil`: full visible soil payload
- `has_bonustime_token` (optional boolean): included only when value changes

Cadence:
- Emitted on absolute UTC minute boundaries (`...:00.000Z`) while a player channel is connected.
- `climate` is computed once globally per UTC minute and reused across all player ticks for that minute.

## Session Superseded
Event name: `session.superseded`

Payload:
- `type`: `"session.superseded"`
- `server_time`: ISO8601 UTC timestamp
- `reason`: machine-readable reason (for example `new_session_activated`)

Ordering:
- Server pushes `session.superseded` before disconnecting the superseded socket.

## Shared Rules
- Push events are never ACKed.
- Push events must never execute durable gameplay transitions.
- Client must synchronize local clock from every push `server_time`.
- Stale push handling: reject only strictly older events (`event.server_time < last_applied_server_time`); equal timestamps are valid.
- Boot/reconnect is snapshot-first; push resumes after join.
