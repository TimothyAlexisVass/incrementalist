defmodule Incrementalist.Repo.Migrations.AddClientCommandIds do
  use Ecto.Migration

  def up do
    alter table(:game_commands) do
      add(:command_id, :bigint)
    end

    execute(
      "UPDATE game_commands SET command_id = ((sequence - 1) % 10) WHERE command_id IS NULL"
    )

    alter table(:game_commands) do
      modify(:command_id, :bigint, null: false)
    end

    create(
      constraint(:game_commands, :game_commands_command_id_queue_slot,
        check: "command_id >= 0 AND command_id < 10"
      )
    )

    create(
      unique_index(:game_commands, [:player_id, :command_id],
        name: :game_commands_player_id_command_id_unacked_index,
        where: "acked_at IS NULL"
      )
    )
  end

  def down do
    drop(
      index(:game_commands, [:player_id, :command_id],
        name: :game_commands_player_id_command_id_unacked_index
      )
    )

    drop(constraint(:game_commands, :game_commands_command_id_queue_slot))

    alter table(:game_commands) do
      remove(:command_id)
    end
  end
end
