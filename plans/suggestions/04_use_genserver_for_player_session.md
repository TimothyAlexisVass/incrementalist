# Suggestion: Use GenServer-per-Player for Performance

## Context
The current command queue logic inside `lib/incrementalist/game/commands.ex` ensures strict FIFO ordering by taking an explicit database lock on the `players` row:
```elixir
  defp lock_player!(player_id) do
    Repo.one!(
      from player in Player,
        where: player.id == ^player_id,
        lock: "FOR UPDATE"
    )
  end
```
Every enqueue, acknowledge, and replay operation requires this lock.

## Problem
In an "incremental" or "clicker" game, player actions can be extremely high frequency. Taking a row-level DB lock on the `players` table for every single command, calculating new game state, and updating multiple rows (game state, command log, queues) synchronously within a transaction will cause severe performance bottlenecks on the database. Postgres row locks under high concurrency will quickly lead to contention and reduced throughput.

## Proposed Solution
Adopt the standard Erlang/Elixir pattern for modeling single-actor sequential state: **A GenServer per Player**.
Instead of using Postgres to serialize command processing:
1. Use `Registry` and `DynamicSupervisor` to spawn a long-lived GenServer process for each active player.
2. The player's WebSocket (`GameChannel`) sends commands directly to this GenServer via `GenServer.call/3` or `cast/2`.
3. The GenServer maintains the player's queue and current game state in memory, processing commands sequentially without needing database locks.
4. The GenServer periodically or asynchronously persists state and command logs back to the database, acting as a write-behind cache.

### Benefits
- **Performance**: Eliminates blocking database locks entirely during hot-path command execution. In-memory serial execution in Elixir is orders of magnitude faster.
- **Scalability**: Can handle rapid clicking and thousands of concurrent players much more efficiently.
- **Code Quality**: Moves concurrency control to the BEAM VM where it belongs, simplifying the Ecto code which only needs to handle basic CRUD operations without explicit `FOR UPDATE` transaction locks.
