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

  schema "save_slots" do
    field :slot_index, :integer
    field :state, :map
    field :last_saved_at, :utc_datetime

    belongs_to :player, Player

    timestamps(type: :utc_datetime)
  end

  def changeset(save_slot, attrs) do
    save_slot
    |> cast(attrs, [:player_id, :slot_index, :state, :last_saved_at])
    |> validate_required([:player_id, :slot_index])
    |> validate_inclusion(:slot_index, Constants.valid_slot_indexes())
    |> foreign_key_constraint(:player_id)
    |> unique_constraint([:player_id, :slot_index])
  end
end
