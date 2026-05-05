defmodule Incrementalist.Game.Time do
  def now do
    DateTime.utc_now() |> DateTime.truncate(:second)
  end

  def iso8601(%DateTime{} = datetime), do: DateTime.to_iso8601(datetime)
  def iso8601(nil), do: nil
end
