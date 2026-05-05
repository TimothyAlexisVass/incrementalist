import Config

config :incrementalist, Incrementalist.Repo,
  username: System.get_env("POSTGRES_USER") || "postgres",
  password: System.get_env("POSTGRES_PASSWORD") || "postgres",
  hostname: System.get_env("POSTGRES_HOST") || "localhost",
  port: String.to_integer(System.get_env("POSTGRES_PORT") || "5432"),
  database:
    "#{System.get_env("POSTGRES_TEST_DB") || "incrementalist_test"}#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: 10

config :incrementalist, IncrementalistWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "qHeFVBCNTsLaD69zFLfhLP2huPa0AJh3A34aVC5FucEGnsmNhPAFvr74mPvLAxbt",
  server: false

config :logger, level: :warning
