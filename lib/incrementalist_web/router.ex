defmodule IncrementalistWeb.Router do
  use IncrementalistWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", IncrementalistWeb do
    pipe_through :browser

    get "/", PageController, :index
  end

  scope "/api", IncrementalistWeb do
    pipe_through :api

    get "/clicks", ClickController, :show
    post "/clicks", ClickController, :create
  end
end
