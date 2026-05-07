defmodule Incrementalist.Game.Persistence.Player do
  @moduledoc """
  Player identity, contact details, and active save-slot pointer.

  Gameplay state belongs to a player, not to a browser tab or request. The active
  save slot lives here so clients cannot switch durable context by sending slot
  claims with individual commands.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query

  alias Incrementalist.Game.Constants

  schema "players" do
    field :email, :string
    field :active_save_slot, :integer, default: 0
    field :username, :string
    field :last_seen_at, :utc_datetime

    timestamps(type: :utc_datetime)
  end

  def changeset(player, attrs) do
    player
    |> cast(attrs, [:username, :email, :active_save_slot, :last_seen_at])
    |> validate_required([:username, :active_save_slot, :last_seen_at])
    |> validate_inclusion(:active_save_slot, Constants.valid_slot_indexes())
    |> unique_constraint(:username)
  end

  def cleanup_anonymous(now \\ Incrementalist.Game.Time.now()) do
    cutoff = DateTime.add(now, -(90 * 24 * 60 * 60), :second)

    {count, _rows} =
      Incrementalist.Repo.delete_all(
        from player in __MODULE__,
          where: is_nil(player.email) and player.last_seen_at < ^cutoff
      )

    count
  end
end
