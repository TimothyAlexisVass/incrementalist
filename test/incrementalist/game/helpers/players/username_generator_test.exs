defmodule Incrementalist.Game.Helpers.Players.UsernameGeneratorTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.Helpers.Players.UsernameGenerator

  test "generate_unique retries until the callback accepts a username" do
    Process.put(:username_generator_values, ["Alpha", "Beta"])

    generator = fn ->
      [value | rest] = Process.get(:username_generator_values)
      Process.put(:username_generator_values, rest)
      value
    end

    username =
      UsernameGenerator.generate_unique(
        fn candidate -> candidate == "Alpha" end,
        generator
      )

    assert username == "Beta"
  end
end
