defmodule Incrementalist.Game.Persistence.Player do
  @moduledoc """
  Player identity and active save-slot pointer.

  Gameplay state belongs to a player, not to a browser tab or request. The active
  save slot lives here so clients cannot switch durable context by sending slot
  claims with individual commands.
  """

  use Ecto.Schema

  import Ecto.Changeset

  @slot_indexes 0..3

  schema "players" do
    field :active_save_slot, :integer, default: 0
    field :last_seen_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(player, attrs) do
    player
    |> cast(attrs, [:active_save_slot, :last_seen_at])
    |> validate_required([:active_save_slot, :last_seen_at])
    |> validate_inclusion(:active_save_slot, @slot_indexes)
  end
end
