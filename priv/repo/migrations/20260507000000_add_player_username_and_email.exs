defmodule Incrementalist.Repo.Migrations.AddPlayerUsernameAndEmail do
  use Ecto.Migration

  import Ecto.Query

  alias Incrementalist.Game.Helpers.Players.UsernameGenerator

  def up do
    alter table(:players) do
      add(:username, :string)
      add(:email, :string)
    end

    backfill_existing_usernames()

    alter table(:players) do
      modify(:username, :string, null: false)
    end

    create(unique_index(:players, [:username]))

    drop(table(:anonymous_player_tokens))
  end

  def down do
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

    drop_if_exists(index(:players, [:username]))

    alter table(:players) do
      remove(:username)
      remove(:email)
    end
  end

  defp backfill_existing_usernames do
    repo = repo()
    used_usernames = MapSet.new()

    from(player in "players", select: player.id)
    |> repo.all()
    |> Enum.reduce(used_usernames, fn player_id, used ->
      username = generate_unique_username(used)

      execute("UPDATE players SET username = '#{username}' WHERE id = #{player_id}")
      MapSet.put(used, username)
    end)
  end

  defp generate_unique_username(used_usernames) do
    candidate = UsernameGenerator.generate()

    if MapSet.member?(used_usernames, candidate) do
      generate_unique_username(used_usernames)
    else
      candidate
    end
  end
end
