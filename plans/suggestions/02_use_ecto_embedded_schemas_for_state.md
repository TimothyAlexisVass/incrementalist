# Suggestion: Use Ecto Embedded Schemas for Game State

## Context
Currently, the game state stored within each `SaveSlot` is a map representing JSON. In `lib/incrementalist/game/state.ex`, reading and sanitizing this state relies on manual type-checking functions (`integer/3`, `number/3`, `string/3`, `boolean/3`) and manual `Map.get/3` usage.

```elixir
  def visible_state(state) when is_map(state) do
    progress_bar = Map.get(state, "progress_bar", %{})

    %{
      "area" => string(state, "area", "sage"),
      "level" => integer(state, "level", 1),
      "exp" => integer(state, "exp", 0),
      # ...
    }
  end
```

## Problem
While flexible, this pattern has several downsides:
- **Code Quality**: Custom parsing functions clutter the domain logic.
- **Maintenance**: Adding or modifying fields requires manual changes in multiple places (initialization `new/1`, serialization `visible_state/1`, summary `summary/2`).
- **Validation**: There is no built-in mechanism to validate complex constraints (e.g., max levels, ensuring IDs are within enums) other than writing more custom functions.
- **Best Practices**: It ignores the robust validation and casting tools already provided by `Ecto`, which is already used heavily in the repository for database interactions.

## Proposed Solution
Refactor `Incrementalist.Game.State` (and any nested data structures, like `progress_bar` and `features`) to use Ecto's `embedded_schema` and `changeset` features.

```elixir
defmodule Incrementalist.Game.State do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :version, :integer, default: 1
    field :area, :string, default: "sage"
    field :level, :integer, default: 1
    field :exp, :integer, default: 0
    # ...
    embeds_one :progress_bar, ProgressBar
    embeds_one :features, Features
    embeds_one :sisu, Sisu
  end

  def changeset(state \\ %__MODULE__{}, attrs) do
    state
    |> cast(attrs, [:version, :area, :level, :exp, ...])
    |> cast_embed(:progress_bar)
    |> cast_embed(:features)
    |> cast_embed(:sisu)
  end
end
```

### Benefits
- **Consistency**: Relies on Ecto's standard API for data validation and casting, making the code much more idiomatic to Elixir developers.
- **Safety**: `Ecto.Changeset` handles nil cases, missing fields, and type coercions out of the box, cleanly rejecting invalid states or merging them with robust defaults.
- **Code Quality**: Removes custom boilerplate string/integer checking functions, vastly improving the readability and clarity of the `State` module.
