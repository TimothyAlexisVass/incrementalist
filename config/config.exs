import Config

config :incrementalist,
  ecto_repos: [Incrementalist.Repo]

config :incrementalist, IncrementalistWeb.Endpoint,
  url: [host: "localhost"],
  render_errors: [
    formats: [json: IncrementalistWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Incrementalist.PubSub

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
