defmodule Incrementalist.Game.Persistence.AnonymousPlayerToken do
  @moduledoc """
  Hashed anonymous browser token tied to a player.

  The raw token is a bearer credential held by the browser. Only its hash is
  stored, and expiry is based on activity so abandoned anonymous identities can
  be removed without touching the save-slot model.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Incrementalist.Game.Persistence.Player

  schema "anonymous_player_tokens" do
    field :token_hash, :string
    field :last_seen_at, :utc_datetime
    field :expires_at, :utc_datetime

    belongs_to :player, Player

    timestamps(type: :utc_datetime)
  end

  def changeset(token, attrs) do
    token
    |> cast(attrs, [:player_id, :token_hash, :last_seen_at, :expires_at])
    |> validate_required([:player_id, :token_hash, :last_seen_at, :expires_at])
    |> foreign_key_constraint(:player_id)
    |> unique_constraint(:token_hash)
  end
end
