defmodule Incrementalist.Game.State do
  @moduledoc """
  Versioned save-state using Ecto embedded schemas.

  The persisted JSON can contain internal fields that are not part of the wire
  contract. Snapshots and save summaries are separate projections that include
  only data the player is allowed to render.
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Incrementalist.Game.Time

  @current_version 1

  defmodule ProgressBar do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :sisu, :integer, default: 1
      field :reward_multiplier, :float, default: 1.0
      field :rewards_claimed, :integer, default: 0
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      schema
      |> cast(attrs, [:sisu, :reward_multiplier, :rewards_claimed])
    end
  end

  defmodule Features do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :idle_mode_purchased, :boolean, default: false
      field :world_map_unlocked, :boolean, default: false
      field :sisu_generator_purchased, :boolean, default: false
      field :bonus_time_purchased, :boolean, default: false
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      schema
      |> cast(attrs, [
        :idle_mode_purchased,
        :world_map_unlocked,
        :sisu_generator_purchased,
        :bonus_time_purchased
      ])
    end
  end

  defmodule Sisu do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :current, :integer, default: 1
      field :max, :integer, default: 1
      field :level, :integer, default: 1
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      schema
      |> cast(attrs, [:current, :max, :level])
    end
  end

  @primary_key false
  @derive Jason.Encoder
  embedded_schema do
    field :version, :integer, default: @current_version
    field :area, :string, default: "sage"
    field :level, :integer, default: 1
    field :exp, :integer, default: 0
    field :required_exp, :integer, default: 20
    field :coins, :integer, default: 0
    field :shards, :integer, default: 0
    field :cores, :integer, default: 0
    field :idle_mode, :boolean, default: false
    field :first_played_at, :string
    field :last_claimed_at, :string
    field :can_claim_at, :string
    field :saved_at, :string

    embeds_one :progress_bar, ProgressBar, on_replace: :update
    embeds_one :features, Features, on_replace: :update
    embeds_one :sisu, Sisu, on_replace: :update
  end

  def changeset(state \\ %__MODULE__{}, attrs) do
    attrs_map = normalize_attrs(attrs)

    state
    |> cast(attrs_map, [
      :version,
      :area,
      :level,
      :exp,
      :required_exp,
      :coins,
      :shards,
      :cores,
      :idle_mode,
      :first_played_at,
      :last_claimed_at,
      :can_claim_at,
      :saved_at
    ])
    |> cast_embed(:progress_bar)
    |> cast_embed(:features)
    |> cast_embed(:sisu)
  end

  defp normalize_attrs(%__MODULE__{} = attrs) do
    attrs
    |> Map.from_struct()
    |> normalize_embed_fields()
  end

  defp normalize_attrs(attrs) when is_map(attrs), do: normalize_embed_fields(attrs)
  defp normalize_attrs(attrs), do: attrs

  defp normalize_embed_fields(attrs) do
    attrs
    |> maybe_put_embed(:progress_bar)
    |> maybe_put_embed(:features)
    |> maybe_put_embed(:sisu)
  end

  defp maybe_put_embed(attrs, key) do
    {lookup_key, value} =
      cond do
        Map.has_key?(attrs, key) ->
          {key, Map.get(attrs, key)}

        Map.has_key?(attrs, Atom.to_string(key)) ->
          {Atom.to_string(key), Map.get(attrs, Atom.to_string(key))}

        true ->
          {key, nil}
      end

    case value do
      %_{} = struct -> Map.put(attrs, lookup_key, Map.from_struct(struct))
      _ -> attrs
    end
  end

  def new(now \\ Time.now()) do
    timestamp = Time.iso8601(now)

    %__MODULE__{
      version: @current_version,
      area: "sage",
      level: 1,
      exp: 0,
      required_exp: 20,
      coins: 0,
      shards: 0,
      cores: 0,
      idle_mode: false,
      first_played_at: timestamp,
      last_claimed_at: timestamp,
      can_claim_at: nil,
      saved_at: timestamp,
      progress_bar: %ProgressBar{
        sisu: 1,
        reward_multiplier: 1.0,
        rewards_claimed: 0
      },
      features: %Features{
        idle_mode_purchased: false,
        world_map_unlocked: false,
        sisu_generator_purchased: false,
        bonus_time_purchased: false
      },
      sisu: %Sisu{
        current: 1,
        max: 1,
        level: 1
      }
    }
  end

  def touch_saved_at(nil, now), do: new(now)

  def touch_saved_at(%__MODULE__{} = state, now) do
    %{state | saved_at: Time.iso8601(now)}
  end

  def visible_state(nil), do: visible_state(new())

  def visible_state(%__MODULE__{} = state) do
    %{
      "area" => state.area || "sage",
      "level" => state.level || 1,
      "exp" => state.exp || 0,
      "required_exp" => state.required_exp || 20,
      "coins" => state.coins || 0,
      "shards" => state.shards || 0,
      "cores" => state.cores || 0,
      "idle_mode" => state.idle_mode || false,
      "first_played_at" => state.first_played_at,
      "saved_at" => state.saved_at,
      "progress_bar" => %{
        "sisu" => if(state.progress_bar, do: state.progress_bar.sisu, else: 1),
        "reward_multiplier" =>
          if(state.progress_bar, do: state.progress_bar.reward_multiplier, else: 1.0),
        "rewards_claimed" =>
          if(state.progress_bar, do: state.progress_bar.rewards_claimed, else: 0)
      }
    }
  end

  def summary(slot, active_slot_index) do
    state = slot.state

    %{
      "slot_index" => slot.slot_index,
      "file_index" => slot.slot_index,
      "is_current" => slot.slot_index == active_slot_index,
      "has_data" => state != nil,
      "level" => if(state, do: state.level || 1, else: 1),
      "rewards_claimed" =>
        if(state && state.progress_bar, do: state.progress_bar.rewards_claimed || 0, else: 0),
      "saved_at" => Time.iso8601(slot.last_saved_at)
    }
  end
end
