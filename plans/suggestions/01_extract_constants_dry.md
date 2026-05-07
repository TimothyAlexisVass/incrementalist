# Suggestion: Extract Magic Constants to Adhere to DRY

## Context
Currently, several domain-specific magic numbers are repeated across multiple files in the backend codebase.

For example, the slot index range `0..3` is hardcoded as `@slot_indexes 0..3` in:
- `lib/incrementalist/game/persistence/player.ex`
- `lib/incrementalist/game/persistence/save_slot.ex`
- `lib/incrementalist/game/persistence/save_slots.ex`
- `lib/incrementalist/game/commands.ex`

Similarly, the valid range for command IDs `0..9` and queue limits are hardcoded:
- `lib/incrementalist/game/commands.ex` uses `@queue_limit 10` and `@command_id_slots 0..9`
- `lib/incrementalist/game/persistence/game_command.ex` validates `:command_id` to be between 0 and 9.

## Problem
This repetition violates the DRY (Don't Repeat Yourself) principle. If the game needs to increase the number of save slots from 4 to 8, or change the command queue size, a developer has to find and update these values in every single file. Missed updates would result in validation errors or bugs where the UI assumes one limit and the database another.

## Proposed Solution
Extract these shared constants into a central configuration module, for instance, `Incrementalist.Game.Config` or `Incrementalist.Game.Constants`.

```elixir
defmodule Incrementalist.Game.Constants do
  @moduledoc """
  Centralizes magic numbers and domain limits.
  """

  def max_save_slots, do: 4
  def valid_slot_indexes, do: 0..(max_save_slots() - 1)

  def max_queued_commands, do: 10
  def valid_command_ids, do: 0..(max_queued_commands() - 1)
end
```

Then, in the respective schemas and context modules, call these functions instead of redefining module attributes.

### Benefits
- **Maintainability**: Changing limits requires modifying exactly one file.
- **Consistency**: Prevents accidental discrepancies in different modules.
- **Code Quality**: Clearly defines domain limits in one centralized place, making the codebase easier to understand.
