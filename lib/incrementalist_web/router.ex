defmodule IncrementalistWeb.Router do
  use IncrementalistWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  scope "/", IncrementalistWeb do
    pipe_through :browser

    get "/", PageController, :index
  end

  scope "/debug", IncrementalistWeb do
    pipe_through :browser

    get "/", DebugController, :index
    post "/delete/:id", DebugController, :delete
    get "/edit/:id", DebugController, :edit
    post "/update/:id", DebugController, :update
  end
end
