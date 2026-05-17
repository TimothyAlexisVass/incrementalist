import Config

config :incrementalist, Incrementalist.Repo,
  username: System.get_env("POSTGRES_USER") || "postgres",
  password: System.get_env("POSTGRES_PASSWORD") || "postgres",
  hostname: System.get_env("POSTGRES_HOST") || "localhost",
  port: String.to_integer(System.get_env("POSTGRES_PORT") || "5432"),
  database: System.get_env("POSTGRES_DB") || "incrementalist_dev",
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :incrementalist, IncrementalistWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base:
    System.get_env("SECRET_KEY_BASE") || Base.encode64(:crypto.strong_rand_bytes(48)),
  watchers: [
    {"node", ["build.mjs", "--watch", cd: Path.expand("../assets", __DIR__)]}
  ]

config :phoenix, :stacktrace_depth, 20
