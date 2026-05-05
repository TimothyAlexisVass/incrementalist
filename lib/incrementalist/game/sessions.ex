defmodule Incrementalist.Game.Sessions do
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

  def boot_player(player_id, anonymous_player_token, now \\ Time.now()) do
    player = Repo.get!(Player, player_id)
    snapshot = SaveSlots.snapshot_for_player(player, now)

    %{
      "type" => "game.boot",
      "anonymous_player_token" => anonymous_player_token,
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

  defp unwrap_transaction({:ok, value}), do: value
end
