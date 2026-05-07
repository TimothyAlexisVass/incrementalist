defmodule Incrementalist.Game.Time do
  def now do
    DateTime.utc_now() |> DateTime.truncate(:second)
  end

  def iso8601(%DateTime{} = datetime), do: DateTime.to_iso8601(datetime)
  def iso8601(nil), do: nil

  def from_iso8601(iso_str) when is_binary(iso_str) do
    case DateTime.from_iso8601(iso_str) do
      {:ok, dt, _offset} -> {:ok, dt}
      error -> error
    end
  end
  def from_iso8601(nil), do: {:error, :nil}
  def from_iso8601(_), do: {:error, :invalid}

  def to_unix_ms(%DateTime{} = datetime) do
    DateTime.to_unix(datetime, :millisecond)
  end
end
