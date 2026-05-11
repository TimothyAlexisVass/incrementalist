defmodule Incrementalist.Game.Persistence.SaveSlot do
  @moduledoc """
  One of the four anonymous save files.

  `state == nil` means the slot is visibly empty. Once initialized, `state` is
  versioned JSON so gameplay data can evolve without requiring a relational
  schema change for every rule tweak.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Persistence.Player
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Notices

  schema "save_slots" do
    field :slot_index, :integer
    embeds_one :state, State, on_replace: :update
    embeds_one :notices, Notices, on_replace: :update
    field :last_saved_at, :utc_datetime_usec

    belongs_to :player, Player

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(save_slot, attrs) do
    attrs = normalize_attrs(attrs)

    save_slot
    |> cast(attrs, [:player_id, :slot_index, :last_saved_at])
    |> cast_embed(:state)
    |> cast_embed(:notices)
    |> validate_required([:player_id, :slot_index])
    |> validate_inclusion(:slot_index, Constants.valid_slot_indexes())
    |> foreign_key_constraint(:player_id)
    |> unique_constraint([:player_id, :slot_index])
  end

  defp normalize_attrs(attrs) do
    attrs
    |> normalize_field(:state, State)
    |> normalize_field(:notices, Notices)
  end

  defp normalize_field(attrs, field, module) do
    field_str = Atom.to_string(field)
    cond do
      Map.has_key?(attrs, field) and is_struct(Map.get(attrs, field), module) ->
        Map.put(attrs, field, Map.from_struct(Map.get(attrs, field)))
      Map.has_key?(attrs, field_str) and is_struct(Map.get(attrs, field_str), module) ->
        Map.put(attrs, field_str, Map.from_struct(Map.get(attrs, field_str)))
      true ->
        attrs
    end
  end
end
