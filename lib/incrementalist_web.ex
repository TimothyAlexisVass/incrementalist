defmodule IncrementalistWeb do
  def static_paths, do: ~w(assets fonts images favicon.ico robots.txt)

  def controller do
    quote do
      use Phoenix.Controller, formats: [:html, :json]

      import Plug.Conn
    end
  end

  def router do
    quote do
      use Phoenix.Router, helpers: false

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
