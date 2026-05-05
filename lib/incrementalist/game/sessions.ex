defmodule Incrementalist.Game.Sessions do
  @moduledoc """
  Owns anonymous player identity and boot payload construction.

  Anonymous identity is intentionally separate from save authority. The browser
  may cache visible snapshots for faster rendering, but the token only
  identifies a player. It cannot choose the active slot or queued command.

  The database stores a hash of the token so a DB row is not itself a usable
  browser credential.
  """

  import Ecto.Query

  alias Incrementalist.Game.Persistence.{AnonymousPlayerToken, Player, SaveSlots}
  alias Incrementalist.Game.Time
  alias Incrementalist.Repo

  @token_ttl_seconds 30 * 24 * 60 * 60

  def authenticate_anonymous(token \\ nil, now \\ Time.now()) do
    Repo.transaction(fn ->
      token
      |> find_valid_token(now)
      |> case do
        nil -> create_anonymous_session(now)
        anonymous_token -> refresh_anonymous_session(anonymous_token, now)
      end
    end)
    |> unwrap_transaction()
  end

  def boot_player(
        player_id,
        anonymous_player_token,
        cached_save_slots \\ MapSet.new(),
        now \\ Time.now()
      )

  def boot_player(player_id, anonymous_player_token, %DateTime{} = now, _now) do
    boot_player(player_id, anonymous_player_token, MapSet.new(), now)
  end

  def boot_player(player_id, anonymous_player_token, cached_save_slots, now) do
    player = Repo.get!(Player, player_id)
    active_slot = SaveSlots.determine_active_slot(player, now)
    active_slot_index = active_slot.slot_index
    snapshot = snapshot_unless_cached(active_slot, cached_save_slots, now)

    %{
      "type" => "game.boot",
      # A raw token is returned only when one was minted during this connection.
      # Returning it on every boot would expose a bearer credential needlessly.
      "anonymous_player_token" => anonymous_player_token,
      "active_save_slot" => active_slot_index,
      "save_slot" => Incrementalist.Game.State.summary(active_slot, active_slot_index),
      "snapshot" => snapshot
    }
  end

  def cleanup_expired_tokens(now \\ Time.now()) do
    Repo.delete_all(
      from token in AnonymousPlayerToken,
        where: token.expires_at < ^now
    )
  end

  defp find_valid_token(token, _now) when not is_binary(token), do: nil
  defp find_valid_token("", _now), do: nil

  defp find_valid_token(token, now) do
    token_hash = hash_token(token)

    Repo.one(
      from anonymous_token in AnonymousPlayerToken,
        join: player in assoc(anonymous_token, :player),
        preload: [player: player],
        where: anonymous_token.token_hash == ^token_hash and anonymous_token.expires_at > ^now,
        # Multiple tabs can connect with the same token. Lock the token row while
        # refreshing activity timestamps so expiry and player touch stay coherent.
        lock: "FOR UPDATE"
    )
  end

  defp create_anonymous_session(now) do
    raw_token = generate_token()
    expires_at = DateTime.add(now, @token_ttl_seconds, :second)

    player =
      %Player{}
      |> Player.changeset(%{active_save_slot: 0, last_seen_at: now})
      |> Repo.insert!()

    anonymous_token =
      %AnonymousPlayerToken{}
      |> AnonymousPlayerToken.changeset(%{
        player_id: player.id,
        token_hash: hash_token(raw_token),
        last_seen_at: now,
        expires_at: expires_at
      })
      |> Repo.insert!()

    SaveSlots.ensure_four_slots(player.id, now)

    %{
      player: player,
      anonymous_player_token: raw_token,
      anonymous_token: anonymous_token
    }
  end

  defp refresh_anonymous_session(%AnonymousPlayerToken{} = anonymous_token, now) do
    expires_at = DateTime.add(now, @token_ttl_seconds, :second)

    anonymous_token =
      anonymous_token
      |> AnonymousPlayerToken.changeset(%{last_seen_at: now, expires_at: expires_at})
      |> Repo.update!()

    player =
      anonymous_token.player
      |> Player.changeset(%{last_seen_at: now})
      |> Repo.update!()

    SaveSlots.ensure_four_slots(player.id, now)

    %{
      player: player,
      # Returning nil here preserves the boot shape without re-sending the credential.
      anonymous_player_token: nil,
      anonymous_token: anonymous_token
    }
  end

  defp generate_token do
    32
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end

  defp hash_token(token) do
    :crypto.hash(:sha256, token)
    |> Base.encode16(case: :lower)
  end

  defp snapshot_unless_cached(active_slot, cached_save_slots, now) do
    if MapSet.member?(cached_save_slots, active_slot.slot_index) do
      nil
    else
      Incrementalist.Game.Snapshots.full(active_slot, active_slot.slot_index, now)
    end
  end

  defp unwrap_transaction({:ok, value}), do: value
end
