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

  schema "save_slots" do
    field :slot_index, :integer
    embeds_one :state, State, on_replace: :update
    field :last_saved_at, :utc_datetime

    belongs_to :player, Player

    timestamps(type: :utc_datetime)
  end

  def changeset(save_slot, attrs) do
    attrs = normalize_state_attr(attrs)

    save_slot
    |> cast(attrs, [:player_id, :slot_index, :last_saved_at])
    |> cast_embed(:state)
    |> validate_required([:player_id, :slot_index])
    |> validate_inclusion(:slot_index, Constants.valid_slot_indexes())
    |> foreign_key_constraint(:player_id)
    |> unique_constraint([:player_id, :slot_index])
  end

  defp normalize_state_attr(%{state: %State{} = state_struct} = attrs),
    do: Map.put(attrs, :state, Map.from_struct(state_struct))

  defp normalize_state_attr(%{"state" => %State{} = state_struct} = attrs),
    do: Map.put(attrs, "state", Map.from_struct(state_struct))

  defp normalize_state_attr(attrs), do: attrs
end
