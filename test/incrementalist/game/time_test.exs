defmodule Incrementalist.Game.TimeTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Time

  describe "now/0" do
    test "returns the current datetime with microsecond precision" do
      now = Time.now()
      assert %DateTime{} = now
      assert {_, 6} = now.microsecond

      # Should be very close to the actual current time
      actual_now = DateTime.utc_now()
      diff = DateTime.diff(actual_now, now, :millisecond)
      assert diff >= 0 and diff < 1000
    end
  end

  describe "iso8601/1" do
    test "converts DateTime to ISO8601 string" do
      {:ok, dt, _} = DateTime.from_iso8601("2024-05-17T12:00:00Z")
      assert Time.iso8601(dt) == "2024-05-17T12:00:00Z"
    end

    test "handles nil" do
      assert Time.iso8601(nil) == nil
    end
  end

  describe "from_iso8601/1" do
    test "parses a valid ISO8601 string" do
      assert {:ok, %DateTime{year: 2024, month: 5, day: 17, hour: 12, minute: 0, second: 0}} =
               Time.from_iso8601("2024-05-17T12:00:00Z")
    end

    test "returns error for invalid string" do
      assert Time.from_iso8601("not-a-date") == {:error, :invalid_format}
    end

    test "returns error for nil" do
      assert Time.from_iso8601(nil) == {:error, nil}
    end

    test "returns error for other types" do
      assert Time.from_iso8601(123) == {:error, :invalid}
      assert Time.from_iso8601(%{}) == {:error, :invalid}
    end
  end

  describe "to_unix_ms/1" do
    test "converts DateTime to unix milliseconds" do
      {:ok, dt, _} = DateTime.from_iso8601("2024-05-17T12:00:00Z")
      assert Time.to_unix_ms(dt) == 1_715_947_200_000
    end
  end

  describe "to_utc_day_index/1" do
    test "converts DateTime to days since unix epoch" do
      # 1970-01-01 is day 0
      {:ok, dt1, _} = DateTime.from_iso8601("1970-01-01T00:00:00Z")
      assert Time.to_utc_day_index(dt1) == 0

      # 1970-01-02 is day 1
      {:ok, dt2, _} = DateTime.from_iso8601("1970-01-02T12:00:00Z")
      assert Time.to_utc_day_index(dt2) == 1

      # 2024-05-17 is day 19860
      {:ok, dt3, _} = DateTime.from_iso8601("2024-05-17T12:00:00Z")
      assert Time.to_utc_day_index(dt3) == 19860
    end
  end
end
