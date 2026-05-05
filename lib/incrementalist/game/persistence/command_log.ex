defmodule Incrementalist.Game.Persistence.CommandLog do
  @moduledoc """
  Maintenance functions for the command audit/replay table.

  Processed commands must remain until acknowledged because they are the only
  source for reconnect replay. After acknowledgement, the row is no longer
  needed for correctness and can age out.
  """

  import Ecto.Query

  alias Incrementalist.Game.Persistence.GameCommand
  alias Incrementalist.Game.Time
  alias Incrementalist.Repo

  @acked_retention_seconds 48 * 60 * 60

  def cleanup_acked(now \\ Time.now()) do
    cutoff = DateTime.add(now, -@acked_retention_seconds, :second)

    # Do not delete old processed-but-unacked rows. They are still the current
    # result for a stalled or reconnecting client.
    {count, _rows} =
      Repo.delete_all(
        from command in GameCommand,
          where: not is_nil(command.acked_at) and command.acked_at < ^cutoff
      )

    count
  end
end
