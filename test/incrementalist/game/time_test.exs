defmodule Incrementalist.Game.TimeTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Time

  describe "from_iso8601/1" do
    test "returns {:error, :nil} when given nil" do
      assert Time.from_iso8601(nil) == {:error, nil}
    end

    test "returns {:ok, datetime} when given a valid ISO8601 string" do
      valid_iso_string = "2023-10-25T14:30:00Z"
      assert {:ok, %DateTime{}} = Time.from_iso8601(valid_iso_string)
    end

    test "returns {:error, :invalid} when given an invalid string" do
      invalid_iso_string = "not-a-date"
      assert {:error, :invalid_format} = Time.from_iso8601(invalid_iso_string)
    end

    test "returns {:error, :invalid} when given an invalid type" do
      invalid_type = 123
      assert Time.from_iso8601(invalid_type) == {:error, :invalid}
    end
  end
end
