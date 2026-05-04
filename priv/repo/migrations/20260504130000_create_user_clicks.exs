defmodule Incrementalist.Repo.Migrations.CreateUserClicks do
  use Ecto.Migration

  def change do
    create table(:user_clicks) do
      add :username, :string, null: false
      add :clicks, :integer, null: false, default: 0

      timestamps(type: :utc_datetime)
    end

    create unique_index(:user_clicks, [:username])
  end
end
