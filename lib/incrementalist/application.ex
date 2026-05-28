defmodule Incrementalist.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      Incrementalist.Repo,
      {Phoenix.PubSub, name: Incrementalist.PubSub},
      Incrementalist.Game.Persistence.CommandLog.Cleanup,
      {Registry, keys: :unique, name: Incrementalist.Game.Session.PlayerRegistry},
      Incrementalist.Game.Push.ClimateCache,
      Incrementalist.Game.Session.PlayerSupervisor,
      IncrementalistWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Incrementalist.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    IncrementalistWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
