defmodule IncrementalistWeb.PageController do
  use IncrementalistWeb, :controller

  def index(conn, _params) do
    path = :incrementalist |> :code.priv_dir() |> Path.join("static/index.html")

    send_file(conn, 200, path)
  end
end
