defmodule Incrementalist.Game.Helpers.Players.UsernameGenerator do
  @moduledoc """
  Readable random username generator.

  Examples:
      Incrementalist.Game.Helpers.Players.UsernameGenerator.generate()
      # "Zavennor"

      Incrementalist.Game.Helpers.Players.UsernameGenerator.generate_unique(&username_exists?/1)
      # "Movekkia"
  """

  @consonants ~w[
    b c d f g h j k l m n p r s t v w z
  ]

  @vowels ~w[
    a e i o u y
  ]

  @double_consonants ~w[
    bb cc dd ff gg kk ll mm nn pp rr ss tt zz
  ]

  @consonant_pairs ~w[
    br cr dr fr gr kr pr tr
    ch sh th
    ld lm ln nd nk nt rn rt st
  ]

  @endings ~w[
    a e i o
    ach ak al ai am an ar as ash ay az
    ech ek el ei eim em en er es esh ey ez
    ich id ik il im in ian ir is ish ius iz
    ob och og ok ol om on or os ot osh oz
    ub uel ul um ur us ush uz
  ]

  @patterns [
    [:start, :middle, :end],
    [:start, :middle, :middle, :end]
  ]

  def generate do
    @patterns
    |> random()
    |> Enum.map(&part/1)
    |> Enum.join()
    |> capitalize()
  end

  def generate_unique(username_exists? \\ fn _username -> false end, generator \\ &generate/0) do
    username = generator.()

    if username_exists?.(username) do
      generate_unique(username_exists?, generator)
    else
      username
    end
  end

  defp part(:start) do
    random(@consonants) <> random(@vowels)
  end

  defp part(:middle) do
    case Enum.random(1..4) do
      1 ->
        random(@consonants) <> random(@vowels)

      2 ->
        random(@consonants) <> random(@vowels) <> random(@consonants)

      3 ->
        random(@consonants) <> random(@vowels) <> random(@double_consonants)

      4 ->
        random(@consonants) <> random(@vowels) <> random(@consonant_pairs)
    end
  end

  defp part(:end) do
    random(@endings)
  end

  defp random(list), do: Enum.random(list)

  defp capitalize(username) do
    username
    |> String.downcase()
    |> String.capitalize()
  end
end
