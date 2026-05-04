defmodule Incrementalist.Clicks do
  import Ecto.Query, only: [from: 2]

  alias Incrementalist.Clicks.UserClick
  alias Incrementalist.Repo

  def get_count(username) do
    with {:ok, username} <- normalize_username(username) do
      clicks =
        Repo.one(
          from user_click in UserClick,
            where: user_click.username == ^username,
            select: user_click.clicks
        ) || 0

      {:ok, %{username: username, clicks: clicks}}
    end
  end

  def increment(username) do
    with {:ok, username} <- normalize_username(username) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      %UserClick{}
      |> UserClick.changeset(%{username: username, clicks: 1})
      |> Repo.insert(
        on_conflict: [inc: [clicks: 1], set: [updated_at: now]],
        conflict_target: :username,
        returning: true
      )
      |> case do
        {:ok, user_click} ->
          {:ok, %{username: user_click.username, clicks: user_click.clicks}}

        {:error, changeset} ->
          {:error, error_message(changeset)}
      end
    end
  end

  defp normalize_username(username) when is_binary(username) do
    username = String.trim(username)

    cond do
      username == "" -> {:error, "username is required"}
      String.length(username) > 40 -> {:error, "username must be 40 characters or fewer"}
      true -> {:ok, username}
    end
  end

  defp normalize_username(_username), do: {:error, "username is required"}

  defp error_message(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(fn {message, _opts} -> message end)
    |> Enum.map_join(", ", fn {field, messages} -> "#{field} #{Enum.join(messages, ", ")}" end)
  end
end
