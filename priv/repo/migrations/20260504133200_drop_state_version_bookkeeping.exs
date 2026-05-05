defmodule Incrementalist.Repo.Migrations.DropStateVersionBookkeeping do
  use Ecto.Migration

  def change do
    execute(
      "ALTER TABLE save_slots DROP COLUMN IF EXISTS state_version",
      "ALTER TABLE save_slots ADD COLUMN state_version integer NOT NULL DEFAULT 0"
    )

    execute(
      "ALTER TABLE game_commands DROP COLUMN IF EXISTS state_version",
      "ALTER TABLE game_commands ADD COLUMN state_version integer"
    )
  end
end
