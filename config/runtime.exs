import Config

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "environment variable SECRET_KEY_BASE is missing"

  config :incrementalist, Incrementalist.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10")

  check_origin =
    case System.get_env("CORS_ALLOWED_ORIGINS") do
      nil -> true
      origins -> String.split(origins, ",")
    end

  config :incrementalist, IncrementalistWeb.Endpoint,
    http: [
      ip: {0, 0, 0, 0},
      port: String.to_integer(System.get_env("PORT") || "4000")
    ],
    secret_key_base: secret_key_base,
    check_origin: check_origin,
    server: true
end
