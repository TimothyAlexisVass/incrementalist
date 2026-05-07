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
    # The username identifies only the player. Active slot and command order are
    # resolved after authentication from server-side rows.
    player = Sessions.authenticate_player(Map.get(params, "username"))

    {:ok,
     socket
     |> assign(:player_id, player.id)
     |> assign(:cached_save_slots, cached_save_slots(params))}
  end

  @impl true
  def id(socket), do: "player:#{socket.assigns.player_id}"

  defp cached_save_slots(%{"cached_save_slots" => slots}) when is_binary(slots) do
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

  defp cached_save_slots(_params), do: MapSet.new()
end
