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
      field :reward_multiplier, :float, default: 1.0
      field :rewards_claimed, :integer, default: 0
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:reward_multiplier, :rewards_claimed])
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
      embeds_one :current, BigNum, on_replace: :update
      embeds_one :max_basic, BigNum, on_replace: :update
      field :max_upgrade_level, :integer, default: 0
      field :cycle_decay, :float, default: 3.5
      field :projected_at, :string
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:max_upgrade_level, :cycle_decay, :projected_at])
      |> cast_embed(:current)
      |> cast_embed(:max_basic)
    end
  end

  @primary_key false
  @derive Jason.Encoder
  embedded_schema do
    field :version, :integer, default: @current_version
    field :area, :string, default: "sage"
    field :level, :integer, default: 1

    embeds_one :exp, BigNum, on_replace: :update
    embeds_one :required_exp, BigNum, on_replace: :update
    embeds_one :coins, BigNum, on_replace: :update
    embeds_one :shards, BigNum, on_replace: :update
    embeds_one :cores, BigNum, on_replace: :update

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
      :idle_mode,
      :first_played_at,
      :last_claimed_at,
      :can_claim_at,
      :saved_at
    ])
    |> cast_embed(:exp)
    |> cast_embed(:required_exp)
    |> cast_embed(:coins)
    |> cast_embed(:shards)
    |> cast_embed(:cores)
    |> cast_embed(:progress_bar)
    |> cast_embed(:features)
    |> cast_embed(:sisu)
  end

  defp normalize_attrs(%__MODULE__{} = attrs) do
    attrs
    |> to_map()
    |> normalize_embed_fields()
  end

  defp normalize_attrs(attrs) when is_map(attrs), do: normalize_embed_fields(attrs)
  defp normalize_attrs(attrs), do: attrs

  defp to_map(struct) when is_struct(struct) do
    struct
    |> Map.from_struct()
    |> Enum.map(fn {k, v} -> {k, to_map(v)} end)
    |> Map.new()
  end

  defp to_map(list) when is_list(list), do: Enum.map(list, &to_map/1)
  defp to_map(val), do: val

  defp normalize_embed_fields(attrs) do
    attrs
    |> maybe_put_embed(:exp)
    |> maybe_put_embed(:required_exp)
    |> maybe_put_embed(:coins)
    |> maybe_put_embed(:shards)
    |> maybe_put_embed(:cores)
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
      %_{} = struct -> Map.put(attrs, lookup_key, to_map(struct))
      _ -> attrs
    end
  end

  def new(now \\ Time.now()) do
    timestamp = Time.iso8601(now)

    %__MODULE__{
      version: @current_version,
      area: "sage",
      level: 1,
      exp: BigNum.zero(),
      required_exp: BigNum.from_number(20),
      coins: BigNum.zero(),
      shards: BigNum.zero(),
      cores: BigNum.zero(),
      idle_mode: false,
      first_played_at: timestamp,
      last_claimed_at: timestamp,
      can_claim_at: nil,
      saved_at: timestamp,
      progress_bar: %ProgressBar{
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
        current: BigNum.one(),
        max_basic:
          BigNum.from_number(Incrementalist.Game.Features.Progress.Sisu.Levels.base_max()),
        max_upgrade_level: 0,
        cycle_decay: 3.5,
        projected_at: timestamp
      }
    }
  end

  def touch_saved_at(nil, now), do: new(now)

  def touch_saved_at(%__MODULE__{} = state, now) do
    %{state | saved_at: Time.iso8601(now)}
  end

  def visible_state(nil, now), do: visible_state(new(now), now)

  def visible_state(%__MODULE__{} = state, now) do
    projected_state = Incrementalist.Game.Features.Progress.Sisu.project_state(state, now)

    %{
      "area" => projected_state.area || "sage",
      "level" => projected_state.level || 1,
      "exp" => projected_state.exp || BigNum.zero(),
      "required_exp" => projected_state.required_exp || BigNum.from_number(20),
      "coins" => projected_state.coins || BigNum.zero(),
      "shards" => projected_state.shards || BigNum.zero(),
      "cores" => projected_state.cores || BigNum.zero(),
      "idle_mode" => projected_state.idle_mode || false,
      "first_played_at" => projected_state.first_played_at,
      "saved_at" => projected_state.saved_at,
      "progress_bar" => %{
        "reward_multiplier" =>
          if(projected_state.progress_bar,
            do: projected_state.progress_bar.reward_multiplier,
            else: 1.0
          ),
        "rewards_claimed" =>
          if(projected_state.progress_bar,
            do: projected_state.progress_bar.rewards_claimed,
            else: 0
          )
      },
      "sisu" => %{
        "current" =>
          if(projected_state.sisu,
            do: projected_state.sisu.current || BigNum.one(),
            else: BigNum.one()
          ),
        "max_basic" =>
          if(
            projected_state.sisu && projected_state.sisu.max_basic,
            do: projected_state.sisu.max_basic,
            else: BigNum.from_number(Incrementalist.Game.Features.Progress.Sisu.Levels.base_max())
          ),
        "max_upgrade_level" =>
          if(projected_state.sisu, do: projected_state.sisu.max_upgrade_level || 0, else: 0),
        "cycle_decay" =>
          if(projected_state.sisu, do: projected_state.sisu.cycle_decay || 3.5, else: 3.5)
      },
      "areas" =>
        Enum.map(Incrementalist.Game.Constants.area_defs(), fn area_def ->
          Map.put(area_def, :is_locked, (projected_state.level || 1) < area_def.unlock_level)
        end),
      "features" => %{
        "idle_mode_purchased" => projected_state.features.idle_mode_purchased,
        "world_map_unlocked" => projected_state.features.world_map_unlocked,
        "sisu_generator_purchased" => projected_state.features.sisu_generator_purchased,
        "bonus_time_purchased" => projected_state.features.bonus_time_purchased
      },
      "shop" =>
        Enum.map(Incrementalist.Game.Constants.shop_item_defs(), fn def ->
          is_purchased =
            case def.id do
              "idle_mode" -> projected_state.features.idle_mode_purchased
              "sisu_generator" -> projected_state.features.sisu_generator_purchased
              "bonus_time" -> projected_state.features.bonus_time_purchased
              _ -> false
            end

          def
          |> Map.put(:is_purchased, is_purchased)
          |> Map.put(:can_purchase, !is_purchased && projected_state.level >= def.required_level)
        end),
      "projection_params" => %{
        "fill_rate" =>
          Incrementalist.Game.Features.Progress.Bar.get_progress_bar_fill_rate(
            projected_state,
            now
          ),
        "can_claim_at" => projected_state.can_claim_at
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
