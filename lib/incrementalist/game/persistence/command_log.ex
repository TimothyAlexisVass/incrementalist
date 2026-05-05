defmodule Incrementalist.Game.Persistence.CommandLog do
  import Ecto.Query

  alias Incrementalist.Game.Persistence.GameCommand
  alias Incrementalist.Game.Time
  alias Incrementalist.Repo

  @acked_retention_seconds 48 * 60 * 60

  def cleanup_acked(now \\ Time.now()) do
    cutoff = DateTime.add(now, -@acked_retention_seconds, :second)

    {count, _rows} =
      Repo.delete_all(
        from command in GameCommand,
          where: not is_nil(command.acked_at) and command.acked_at < ^cutoff
      )

    count
  end
end
