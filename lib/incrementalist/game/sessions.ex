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
    player = Repo.get!(Player, player_id)
    active_slot = SaveSlots.determine_active_slot(player, now)
    active_slot_index = active_slot.slot_index
    snapshot = snapshot_unless_cached(active_slot, cached_save_slots, now)

    %{
      "type" => "game.boot",
      "username" => player.username,
      "active_save_slot" => active_slot_index,
      "save_slot" => Incrementalist.Game.State.summary(active_slot, active_slot_index),
      "snapshot" => snapshot
    }
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

  defp snapshot_unless_cached(active_slot, cached_save_slots, now) do
    if MapSet.member?(cached_save_slots, active_slot.slot_index) do
      nil
    else
      Incrementalist.Game.Snapshots.full(active_slot, active_slot.slot_index, now)
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
