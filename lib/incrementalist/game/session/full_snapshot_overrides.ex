defmodule Incrementalist.Game.Session.FullSnapshotOverrides do
  @moduledoc """
  Tracks one-shot debug requests to force a full snapshot on next socket boot.
  """

  @env_key :debug_full_snapshot_player_ids

  def request(player_id) when is_integer(player_id) do
    player_ids = player_ids() |> MapSet.put(player_id)
    Application.put_env(:incrementalist, @env_key, player_ids)
    :ok
  end

  def consume?(player_id) when is_integer(player_id) do
    current_ids = player_ids()

    if MapSet.member?(current_ids, player_id) do
      Application.put_env(:incrementalist, @env_key, MapSet.delete(current_ids, player_id))
      true
    else
      false
    end
  end

  def clear do
    Application.delete_env(:incrementalist, @env_key)
    :ok
  end

  defp player_ids do
    case Application.get_env(:incrementalist, @env_key, MapSet.new()) do
      %MapSet{} = ids -> ids
      ids when is_list(ids) -> MapSet.new(ids)
      _ -> MapSet.new()
    end
  end
end
