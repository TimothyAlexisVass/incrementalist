defmodule Incrementalist.Game.Persistence.SaveSlot do
  use Ecto.Schema

  import Ecto.Changeset

  alias Incrementalist.Game.Persistence.Player

  @slot_indexes 0..3

  schema "save_slots" do
    field :slot_index, :integer
    field :state, :map
    field :state_version, :integer, default: 0
    field :last_saved_at, :utc_datetime

    belongs_to :player, Player

    timestamps(type: :utc_datetime)
  end

  def changeset(save_slot, attrs) do
    save_slot
    |> cast(attrs, [:player_id, :slot_index, :state, :state_version, :last_saved_at])
    |> validate_required([:player_id, :slot_index, :state_version])
    |> validate_inclusion(:slot_index, @slot_indexes)
    |> validate_number(:state_version, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:player_id)
    |> unique_constraint([:player_id, :slot_index])
  end
end
