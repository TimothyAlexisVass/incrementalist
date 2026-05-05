defmodule Incrementalist.Repo.Migrations.CreateGameFoundation do
  use Ecto.Migration

  def change do
    create table(:players) do
      add(:active_save_slot, :integer, null: false, default: 0)
      add(:last_seen_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime)
    end

    create table(:anonymous_player_tokens) do
      add(:player_id, references(:players, on_delete: :delete_all), null: false)
      add(:token_hash, :string, null: false)
      add(:last_seen_at, :utc_datetime, null: false)
      add(:expires_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:anonymous_player_tokens, [:token_hash]))
    create(index(:anonymous_player_tokens, [:player_id]))
    create(index(:anonymous_player_tokens, [:expires_at]))

    create table(:save_slots) do
      add(:player_id, references(:players, on_delete: :delete_all), null: false)
      add(:slot_index, :integer, null: false)
      add(:state, :map)
      add(:state_version, :integer, null: false, default: 0)
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
      add(:sequence, :bigint, null: false)
      add(:command_type, :string, null: false)
      add(:intent, :map, null: false, default: %{})
      add(:status, :string, null: false, default: "queued")
      add(:result, :map)
      add(:state_version, :integer)
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
  end
end
