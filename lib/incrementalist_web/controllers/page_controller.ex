defmodule IncrementalistWeb.PageController do
  use IncrementalistWeb, :controller

  def index(conn, _params) do
    path = :incrementalist |> :code.priv_dir() |> Path.join("static/index.html")

    conn
    |> put_resp_content_type("text/html")
    |> send_file(200, path)
  end
end
