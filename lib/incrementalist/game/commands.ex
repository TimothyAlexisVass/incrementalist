defmodule Incrementalist.Game.Commands do
  @moduledoc """
  Forwards commands to the active PlayerServer GenServer, dropping the old
  PostgreSQL locking behaviour.
  """
  alias Incrementalist.Game.Session.PlayerSupervisor

  def enqueue(player_id, command_type, intent \\ %{}, _now \\ nil) do
    with {:ok, pid} <- PlayerSupervisor.ensure_started(player_id) do
      GenServer.call(pid, {:enqueue, command_type, intent})
    end
  end

  def ack(player_id, command_id, _now \\ nil) do
    with {:ok, pid} <- PlayerSupervisor.ensure_started(player_id) do
      GenServer.call(pid, {:ack, command_id})
    end
  end

  def replay_pending(player_id) do
    with {:ok, pid} <- PlayerSupervisor.ensure_started(player_id) do
      GenServer.call(pid, :replay_pending)
    end
  end
end
