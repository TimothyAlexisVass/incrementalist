# Fix mid-minute furnace burns

## Problem

The server projects Orchard state in whole UTC-minute steps. A harvest that adds plant matter during a minute can currently be treated as if it had been in the furnace for that entire minute, granting potassium too early.

## Required design

- Keep the server as the only authority and use its UTC command time; do not use client time for burn eligibility.
- Replace the aggregate burn queue with embedded, FIFO burn batches. Each batch stores its BigNum amount and the first UTC minute boundary at which it may burn.
- A batch created exactly on a UTC minute boundary may burn in that minute. A batch created later becomes eligible at the next UTC minute boundary.
- During each projected minute, consume only eligible batches, in FIFO order, up to the server-owned burn rate. Derive the visible aggregate queue from the remaining batches.
- Preserve the no-backwards-compatibility rule: update the embedded schema directly and reset development state rather than accepting the old queue shape.

## Tests

- A batch added at `12:00:30Z` has no burn at `12:01:00Z` and starts burning during the `12:01` minute.
- A second batch added mid-minute to an already burning furnace does not burn early.
- Exact-boundary, multi-batch FIFO, offline projection, reconnect/replay, and queue-exhaustion behavior remain deterministic.
- Snapshot, command result, and `player.tick` expose only the aggregate remaining queue; all tests use explicit UTC timestamps.
