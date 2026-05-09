defmodule Incrementalist.Repo.Migrations.CreateGameSchema do
  use Ecto.Migration

  def change do
    create table(:players) do
      add(:username, :string, null: false)
      add(:email, :string)
      add(:active_save_slot, :integer, null: false, default: 0)
      add(:last_seen_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:players, [:username]))

    create table(:save_slots) do
      add(:player_id, references(:players, on_delete: :delete_all), null: false)
      add(:slot_index, :integer, null: false)
      add(:state, :map)
      add(:notices, :map)
      add(:last_saved_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:save_slots, [:player_id, :slot_index]))

    create(
      constraint(:save_slots, :save_slots_slot_index_range,
        check: "slot_index >= 0 AND slot_index < 4"
      )
    )

    create table(:game_commands) do
      add(:player_id, references(:players, on_delete: :delete_all), null: false)
      add(:save_slot_id, references(:save_slots, on_delete: :nilify_all))
      add(:command_id, :bigint, null: false)
      add(:sequence, :bigint, null: false)
      add(:command_type, :string, null: false)
      add(:intent, :map, null: false, default: %{})
      add(:status, :string, null: false, default: "queued")
      add(:result, :map)
      add(:queued_at, :utc_datetime, null: false)
      add(:processed_at, :utc_datetime)
      add(:acked_at, :utc_datetime)
      add(:replay_count, :integer, null: false, default: 0)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:game_commands, [:player_id, :sequence]))
    create(index(:game_commands, [:player_id, :status, :sequence]))
    create(index(:game_commands, [:player_id, :acked_at]))
    create(index(:game_commands, [:acked_at]))

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
end
