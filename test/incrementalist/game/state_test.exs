defmodule Incrementalist.Game.StateTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.{State, Time}

  test "new soil projected_at is aligned to UTC minute boundary" do
    now = ~U[2026-05-27 18:30:56.123456Z]
    state = State.new(now)

    assert state.soil.projected_at == "2026-05-27T18:30:00.000Z"

    {:ok, projected_at} = Time.from_iso8601(state.soil.projected_at)
    assert DateTime.to_unix(projected_at, :millisecond) |> rem(60_000) == 0
  end
end
