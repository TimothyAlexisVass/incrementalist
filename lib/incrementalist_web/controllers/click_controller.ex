defmodule IncrementalistWeb.ClickController do
  use IncrementalistWeb, :controller

  alias Incrementalist.Clicks

  def show(conn, %{"username" => username}) do
    with {:ok, count} <- Clicks.get_count(username) do
      json(conn, count)
    else
      {:error, message} -> bad_request(conn, message)
    end
  end

  def show(conn, _params) do
    bad_request(conn, "username is required")
  end

  def create(conn, %{"username" => username}) do
    with {:ok, count} <- Clicks.increment(username) do
      json(conn, count)
    else
      {:error, message} -> bad_request(conn, message)
    end
  end

  def create(conn, _params) do
    bad_request(conn, "username is required")
  end

  defp bad_request(conn, message) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: message})
  end
end
