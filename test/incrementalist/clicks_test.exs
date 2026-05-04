defmodule Incrementalist.ClicksTest do
  use Incrementalist.DataCase, async: true

  alias Incrementalist.Clicks

  test "get_count returns zero for a new user" do
    assert {:ok, %{username: "ada", clicks: 0}} = Clicks.get_count("ada")
  end

  test "increment creates and increments per user" do
    assert {:ok, %{username: "ada", clicks: 1}} = Clicks.increment("ada")
    assert {:ok, %{username: "ada", clicks: 2}} = Clicks.increment("ada")
    assert {:ok, %{username: "bea", clicks: 1}} = Clicks.increment("bea")
  end
end
