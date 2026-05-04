defmodule Incrementalist.Clicks.UserClick do
  use Ecto.Schema

  import Ecto.Changeset

  schema "user_clicks" do
    field :username, :string
    field :clicks, :integer, default: 0

    timestamps(type: :utc_datetime)
  end

  def changeset(user_click, attrs) do
    user_click
    |> cast(attrs, [:username, :clicks])
    |> validate_required([:username, :clicks])
    |> validate_length(:username, min: 1, max: 40)
    |> validate_number(:clicks, greater_than_or_equal_to: 0)
    |> unique_constraint(:username)
  end
end
