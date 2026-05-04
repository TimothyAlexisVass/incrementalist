defmodule IncrementalistWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :incrementalist

  @session_options [
    store: :cookie,
    key: "_incrementalist_key",
    signing_salt: "qYcKHk93",
    same_site: "Lax"
  ]

  plug Plug.Static,
    at: "/",
    from: :incrementalist,
    gzip: false,
    only: IncrementalistWeb.static_paths()

  if code_reloading? do
    plug Phoenix.CodeReloader
  end

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options

  plug IncrementalistWeb.Router
end
