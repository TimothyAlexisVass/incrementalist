defmodule Incrementalist.Game.Sessions do
  @moduledoc """
  Owns player identity and boot payload construction.

  Player identity is intentionally separate from save authority. The browser may
  cache visible snapshots for faster rendering, but the username only identifies
  a player. It cannot choose the active slot or queued command.
  """

  import Ecto.Query

  alias Incrementalist.Game.Helpers.Players.UsernameGenerator
  alias Incrementalist.Game.Persistence.{Player, SaveSlots}
  alias Incrementalist.Game.Session.PlayerServer
  alias Incrementalist.Game.Time
  alias Incrementalist.Repo

  def authenticate_player(username \\ nil, now \\ Time.now()) do
    Repo.transaction(fn ->
      username
      |> find_player()
      |> case do
        nil -> create_player(now)
        player -> refresh_player(player, now)
      end
    end)
    |> unwrap_transaction()
  end

  def boot_player(player_id, cached_save_slots \\ MapSet.new(), now \\ Time.now()) do
    PlayerServer.boot_player(player_id, cached_save_slots, now)
  end

  def cleanup_anonymous_players(now \\ Time.now()) do
    Player.cleanup_anonymous(now)
  end

  defp find_player(username) when is_binary(username) do
    username = String.trim(username)

    if username == "" do
      nil
    else
      Repo.one(from player in Player, where: player.username == ^username)
    end
  end

  defp find_player(_username), do: nil

  defp create_player(now) do
    player = insert_player!(now)
    SaveSlots.ensure_four_slots(player.id, now)
    player
  end

  defp refresh_player(%Player{} = player, now) do
    player =
      player
      |> Player.changeset(%{last_seen_at: now})
      |> Repo.update!()

    SaveSlots.ensure_four_slots(player.id, now)
    player
  end

  defp insert_player!(now) do
    username = generate_unique_username()

    case %Player{}
         |> Player.changeset(%{
           username: username,
           email: nil,
           active_save_slot: 0,
           last_seen_at: now
         })
         |> Repo.insert() do
      {:ok, player} ->
        player

      {:error, %Ecto.Changeset{} = changeset} ->
        if Keyword.has_key?(changeset.errors, :username) do
          insert_player!(now)
        else
          raise Ecto.InvalidChangesetError, action: :insert, changeset: changeset
        end
    end
  end

  defp generate_unique_username do
    UsernameGenerator.generate_unique(&player_username_exists?/1)
  end

  defp player_username_exists?(username) do
    Repo.exists?(from player in Player, where: player.username == ^username)
  end

  defp unwrap_transaction({:ok, value}), do: value
end
