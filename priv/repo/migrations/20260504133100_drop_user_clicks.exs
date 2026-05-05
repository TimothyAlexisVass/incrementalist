defmodule Incrementalist.Repo.Migrations.DropUserClicks do
  use Ecto.Migration

  def change do
    drop_if_exists(table(:user_clicks))
  end
end
