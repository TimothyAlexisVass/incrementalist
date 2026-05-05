defmodule IncrementalistWeb.Router do
  use IncrementalistWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
  end

  scope "/", IncrementalistWeb do
    pipe_through :browser

    get "/", PageController, :index
  end
end
