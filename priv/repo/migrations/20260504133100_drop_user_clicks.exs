defmodule Incrementalist.Repo.Migrations.DropUserClicks do
  use Ecto.Migration

  def change do
    # Dropping in a separate migration preserves forward progress for databases
    # that already applied the prototype table creation.
    drop_if_exists(table(:user_clicks))
  end
end
