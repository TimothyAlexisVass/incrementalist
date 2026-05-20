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
    field :has_bonustime_token, :boolean, default: true
    field :bonustime_flips, :integer, default: 0
    field :last_saved_at, :utc_datetime_usec

    belongs_to :player, Player

    timestamps(type: :utc_datetime_usec)
  end

  def changeset(player_state, attrs) do
    attrs = normalize_attrs(attrs)

    player_state
    |> cast(attrs, [:player_id, :last_saved_at, :has_bonustime_token, :bonustime_flips])
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

  def inject_state_tokens(%__MODULE__{state: %State{} = state} = ps) do
    bonustime = state.bonustime || %State.BonusTime{}
    new_bonustime = %{bonustime | bonustime_flips: ps.bonustime_flips || 0}

    state_with_tokens = %{
      state
      | bonustime: new_bonustime,
        has_bonustime_token: ps.has_bonustime_token
    }

    %{ps | state: state_with_tokens}
  end

  def inject_state_tokens(ps), do: ps

  def extract_state_tokens(%State{} = state) do
    state.has_bonustime_token || false
  end

  def extract_bonustime_flips(%State{} = state) do
    if state.bonustime do
      state.bonustime.bonustime_flips || 0
    else
      0
    end
  end
end
