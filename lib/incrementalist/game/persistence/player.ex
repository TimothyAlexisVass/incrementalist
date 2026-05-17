defmodule Incrementalist.Game.Persistence.Player do
  @moduledoc """
  Player identity and contact details.

  Gameplay state belongs to a player, not to a browser tab or request.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query

  schema "players" do
    field :email, :string
    field :username, :string
    field :last_seen_at, :utc_datetime_usec

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(player, attrs) do
    player
    |> cast(attrs, [:username, :email, :last_seen_at])
    |> validate_required([:username, :last_seen_at])
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
