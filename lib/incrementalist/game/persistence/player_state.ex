defmodule Incrementalist.Game.Persistence.PlayerState do
  @moduledoc """
  The single game state row for each player.

  `state == nil` means the player has not yet started playing. Once initialized,
  `state` is versioned JSON so gameplay data can evolve without requiring a
  relational schema change for every rule tweak.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Incrementalist.Game.Persistence.Player
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Notices

  schema "player_states" do
    embeds_one :state, State, on_replace: :update
    embeds_one :notices, Notices, on_replace: :update
    field :has_daily_token, :boolean, default: true
    field :last_saved_at, :utc_datetime_usec

    belongs_to :player, Player

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(player_state, attrs) do
    attrs = normalize_attrs(attrs)

    player_state
    |> cast(attrs, [:player_id, :last_saved_at, :has_daily_token])
    |> cast_embed(:state)
    |> cast_embed(:notices)
    |> validate_required([:player_id])
    |> foreign_key_constraint(:player_id)
    |> unique_constraint([:player_id])
  end

  defp normalize_attrs(attrs) do
    attrs
    |> normalize_field(:state, State)
    |> normalize_field(:notices, Notices)
  end

  defp normalize_field(attrs, field, module) do
    field_str = Atom.to_string(field)

    cond do
      Map.has_key?(attrs, field) and is_struct(Map.get(attrs, field), module) ->
        Map.put(attrs, field, Map.from_struct(Map.get(attrs, field)))

      Map.has_key?(attrs, field_str) and is_struct(Map.get(attrs, field_str), module) ->
        Map.put(attrs, field_str, Map.from_struct(Map.get(attrs, field_str)))

      true ->
        attrs
    end
  end

  def inject_state_tokens(%__MODULE__{state: %State{}} = ps) do
    %{ps | state: %{ps.state | has_daily_token: ps.has_daily_token}}
  end

  def inject_state_tokens(ps), do: ps

  def extract_state_tokens(%State{} = state) do
    state.has_daily_token || false
  end
end
