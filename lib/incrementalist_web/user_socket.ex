defmodule IncrementalistWeb.UserSocket do
  @moduledoc """
  Authenticates socket connections with the server-issued username.

  Socket assigns hold the server-resolved player id. Channel messages therefore
  do not need, and must not accept, player ids from the browser.
  """

  use Phoenix.Socket

  alias Incrementalist.Game.Sessions

  channel "game", IncrementalistWeb.GameChannel

  @impl true
  def connect(params, socket, _connect_info) do
    player_id =
      case Map.get(params, "token") do
        token when is_binary(token) ->
          case Phoenix.Token.verify(socket.endpoint, "player_auth", token, max_age: 86400 * 365) do
            {:ok, id} -> id
            _ -> nil
          end
        _ -> nil
      end

    player = Sessions.authenticate_player(player_id)

    {:ok,
     socket
     |> assign(:player_id, player.id)
     |> assign(:cached_save_slots, cached_save_slots(params, player.username))}
  end

  @impl true
  def id(socket), do: "player:#{socket.assigns.player_id}"

  defp cached_save_slots(
         %{"cached_save_slots" => slots, "cache_username" => cache_username},
         player_username
       )
       when is_binary(slots) and is_binary(cache_username) and is_binary(player_username) do
    if cache_username == player_username do
      parse_cached_save_slots(slots)
    else
      MapSet.new()
    end
  end

  defp cached_save_slots(_params, _player_username), do: MapSet.new()

  defp parse_cached_save_slots(slots) do
    slots
    |> String.split(",", trim: true)
    |> Enum.flat_map(fn slot ->
      case Integer.parse(slot) do
        {slot_index, ""} when slot_index in 0..3 -> [slot_index]
        _ -> []
      end
    end)
    |> MapSet.new()
  end
end
