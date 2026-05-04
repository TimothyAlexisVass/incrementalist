defmodule IncrementalistWeb.ConnCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      @endpoint IncrementalistWeb.Endpoint

      import Plug.Conn
      import Phoenix.ConnTest
    end
  end

  setup tags do
    Incrementalist.DataCase.setup_sandbox(tags)
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
