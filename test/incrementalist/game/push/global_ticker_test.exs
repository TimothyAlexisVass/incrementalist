defmodule Incrementalist.Game.Push.GlobalTickerTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.{Climate, Time}
  alias Incrementalist.Game.Push.GlobalTicker

  test "next_minute_boundary_ms aligns to absolute UTC minute boundaries" do
    assert GlobalTicker.next_minute_boundary_ms(0) == 60_000
    assert GlobalTicker.next_minute_boundary_ms(1) == 60_000
    assert GlobalTicker.next_minute_boundary_ms(59_999) == 60_000
    assert GlobalTicker.next_minute_boundary_ms(60_000) == 120_000
    assert GlobalTicker.next_minute_boundary_ms(180_001) == 240_000
  end

  test "global_tick_payload matches the wire contract" do
    at = ~U[2026-05-27 10:31:00.000Z]
    payload = GlobalTicker.global_tick_payload(at)

    assert payload == %{
             "type" => "global.tick",
             "server_time" => Time.iso8601(at),
             "climate" => Climate.visible_state(at)
           }
  end
end
