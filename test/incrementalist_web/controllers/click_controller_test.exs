defmodule IncrementalistWeb.ClickControllerTest do
  use IncrementalistWeb.ConnCase, async: true

  test "reads and increments clicks through the API", %{conn: conn} do
    conn = get(conn, "/api/clicks", %{"username" => "ada"})
    assert %{"username" => "ada", "clicks" => 0} = json_response(conn, 200)

    conn = post(conn, "/api/clicks", %{"username" => "ada"})
    assert %{"username" => "ada", "clicks" => 1} = json_response(conn, 200)

    conn = get(conn, "/api/clicks", %{"username" => "ada"})
    assert %{"username" => "ada", "clicks" => 1} = json_response(conn, 200)
  end
end
