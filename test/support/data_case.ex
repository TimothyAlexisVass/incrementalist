defmodule Incrementalist.DataCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      alias Incrementalist.Repo

      import Ecto
      import Ecto.Changeset
      import Ecto.Query
      import Incrementalist.DataCase
    end
  end

  setup tags do
    setup_sandbox(tags)
    :ok
  end

  def setup_sandbox(tags) do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(Incrementalist.Repo, shared: not tags[:async])
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
  end
end
