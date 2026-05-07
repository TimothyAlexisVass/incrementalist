# Suggestion: Decouple Command Execution Logic

## Context
In `lib/incrementalist/game/commands.ex`, the `Incrementalist.Game.Commands` module acts as a queue manager, handles database transaction locking, coordinates the state of commands (`queued`, `succeeded`, `acked`), and *also* implements the business logic for executing specific commands.

```elixir
  defp execute_command(%GameCommand{} = command, %Player{} = player, now) do
    # ...
      case command.command_type do
        "game.noop" -> ...
        "save_slots.list" -> ...
        "save_slot.switch" -> execute_switch(...)
        "save_slot.reset" -> execute_reset(...)
        _unknown -> ...
      end
    # ...
  end
```

## Problem
Mixing queue management and business logic in the same module violates the Single Responsibility Principle. As new gameplay mechanics (e.g., leveling up, purchasing upgrades, battling) are added, the `Commands` module will grow rapidly into an unmaintainable monolith. The `execute_command/3`, `execute_switch/3`, and `execute_reset/3` functions entangle game rules directly into the persistence logic.

## Proposed Solution
Decouple the game rules from the queue persistence. Introduce an `Incrementalist.Game.CommandExecutor` (or `GameRules`) module whose sole responsibility is to take a command intent and current game state, and return the modified state/result.

1. `Commands.ex` remains responsible only for checking the command limits, persisting to the database, enforcing FIFO order, and managing replay boundaries.
2. `CommandExecutor.ex` becomes a pure(r) module handling the business rules mapping `command_type` to game changes.

```elixir
defmodule Incrementalist.Game.CommandExecutor do
  def execute("save_slot.switch", player, intent, now) do
    # Business logic for switching slot
  end

  def execute("save_slot.reset", player, _intent, now) do
     # Business logic for reset
  end

  # other game actions
end
```

### Benefits
- **Separation of Concerns**: Persistence/transaction logic is fully isolated from game mechanics.
- **Testability**: The business logic can be unit-tested without requiring full database transaction setups for the queue.
- **Maintainability**: The `Commands.ex` file size remains static even as hundreds of new game actions are introduced to `CommandExecutor.ex`.
