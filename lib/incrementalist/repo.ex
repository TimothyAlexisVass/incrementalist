defmodule Incrementalist.Repo do
  use Ecto.Repo,
    otp_app: :incrementalist,
    adapter: Ecto.Adapters.Postgres
end
