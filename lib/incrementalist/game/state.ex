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

  defmodule ChargeCrystals do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :azure, :integer, default: 0
      field :aether, :integer, default: 0
      field :lucent, :integer, default: 0
      field :transcendent, :integer, default: 0
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:azure, :aether, :lucent, :transcendent])
    end

    def visible_state(nil), do: visible_state(%__MODULE__{})

    def visible_state(%__MODULE__{} = crystals) do
      %{
        "azure" => crystals.azure || 0,
        "aether" => crystals.aether || 0,
        "lucent" => crystals.lucent || 0,
        "transcendent" => crystals.transcendent || 0
      }
    end
  end

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
      embeds_one :target_current, BigNum, on_replace: :update
      field :active_tier, :string, default: "azure"
      field :target_cycle_decay, :float
      field :max_upgrade_level, :integer, default: 0
      field :cycle_decay, :float
      field :projected_at, :string
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [
        :max_upgrade_level,
        :cycle_decay,
        :projected_at,
        :target_cycle_decay,
        :active_tier
      ])
      |> cast_embed(:current)
      |> cast_embed(:max_basic)
      |> cast_embed(:target_current)
    end
  end

  defmodule QuestState do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :id, :string
      field :rank, :integer, default: 0
      field :progress, :float, default: 0.0
      field :claimed_rank, :integer, default: 0
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:id, :rank, :progress, :claimed_rank])
      |> validate_required([:id])
    end
  end

  defmodule Stats do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :total_achievements, :integer, default: 0
      field :total_quests_claimed, :integer, default: 0
      field :total_progress_claims, :integer, default: 0
      field :total_days_played, :integer, default: 0
      field :total_level_ups_daily, :integer, default: 0
      field :screens_viewed_stats, :boolean, default: false
      field :screens_viewed_quests, :boolean, default: false
      field :screens_viewed_achievements, :boolean, default: false
      field :tutorial_graduated, :boolean, default: false
      field :last_reset_at, :string

      # Currencies are BigNum
      embeds_one :total_coins_earned, BigNum, on_replace: :update
      embeds_one :total_shards_earned, BigNum, on_replace: :update
      embeds_one :total_cores_earned, BigNum, on_replace: :update
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [
        :total_achievements,
        :total_quests_claimed,
        :total_progress_claims,
        :total_days_played,
        :total_level_ups_daily,
        :screens_viewed_stats,
        :screens_viewed_quests,
        :screens_viewed_achievements,
        :tutorial_graduated,
        :last_reset_at
      ])
      |> cast_embed(:total_coins_earned)
      |> cast_embed(:total_shards_earned)
      |> cast_embed(:total_cores_earned)
    end
  end

  defmodule ActiveSession do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :type, :string
      field :data, :map, default: %{}
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      schema
      |> cast(attrs, [:type, :data])
      |> validate_required([:type, :data])
    end
  end

  defmodule DailyBonus do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :special_tokens, :integer, default: 0
      field :last_token_boundary_index, :integer, default: 0
      field :streak, :integer, default: 0
      field :last_played_at, :string
      field :total_games_played, :integer, default: 0
      field :reward_counts, :map, default: %{
        "tier_1" => 0,
        "tier_2" => 0,
        "tier_3" => 0,
        "tier_4" => 0,
        "tier_5" => 0,
        "tier_6" => 0,
        "tier_7" => 0
      }
      field :checklist_entry_indexes, :map, default: %{
        "resource" => 0,
        "item" => 0
      }
      field :last_result, :map

      embeds_one :active_session, Incrementalist.Game.State.ActiveSession, on_replace: :update
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      schema
      |> cast(attrs, [
        :special_tokens,
        :last_token_boundary_index,
        :streak,
        :last_played_at,
        :total_games_played,
        :reward_counts,
        :checklist_entry_indexes,
        :last_result
      ])
      |> cast_embed(:active_session)
    end
  end

  @primary_key false
  @derive Jason.Encoder
  embedded_schema do
    field :version, :integer, default: @current_version
    field :area, :string, default: "sage"
    field :level, :integer, default: 1
    field :has_daily_token, :boolean, virtual: true, default: true

    embeds_one :exp, BigNum, on_replace: :update
    embeds_one :required_exp, BigNum, on_replace: :update
    embeds_one :coins, BigNum, on_replace: :update
    embeds_one :shards, BigNum, on_replace: :update
    embeds_one :cores, BigNum, on_replace: :update

    field :idle_mode, :boolean, default: false
    field :first_played_at, :string
    field :last_claimed_at, :string
    field :cycle_started_at, :string
    field :can_claim_at, :string
    field :saved_at, :string

    embeds_one :progress_bar, ProgressBar, on_replace: :update
    embeds_one :charge_crystals, ChargeCrystals, on_replace: :update
    embeds_one :features, Features, on_replace: :update
    embeds_one :sisu, Sisu, on_replace: :update

    embeds_many :quests, __MODULE__.QuestState, on_replace: :delete
    embeds_one :stats, __MODULE__.Stats, on_replace: :update
    embeds_one :daily_bonus, __MODULE__.DailyBonus, on_replace: :update
    field :achievements, :map, default: %{}
  end

  # State schema follows

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
      :cycle_started_at,
      :can_claim_at,
      :saved_at,
      :achievements
    ])
    |> cast_embed(:exp)
    |> cast_embed(:required_exp)
    |> cast_embed(:coins)
    |> cast_embed(:shards)
    |> cast_embed(:cores)
    |> cast_embed(:progress_bar)
    |> cast_embed(:charge_crystals)
    |> cast_embed(:features)
    |> cast_embed(:sisu)
    |> cast_embed(:quests)
    |> cast_embed(:stats)
    |> cast_embed(:daily_bonus)
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
    |> maybe_put_embed(:charge_crystals)
    |> maybe_put_embed(:features)
    |> maybe_put_embed(:sisu)
    |> maybe_put_embed(:quests)
    |> maybe_put_embed(:stats)
    |> maybe_put_embed(:daily_bonus)
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
      list when is_list(list) -> Map.put(attrs, lookup_key, to_map(list))
      _ -> attrs
    end
  end

  def new(now \\ Time.now()) do
    timestamp = Time.iso8601(now)

    %__MODULE__{
      version: @current_version,
      area: "sage",
      level: 1,
      has_daily_token: true,
      exp: BigNum.zero(),
      required_exp: BigNum.from_number(20),
      coins: BigNum.zero(),
      shards: BigNum.zero(),
      cores: BigNum.zero(),
      idle_mode: false,
      first_played_at: timestamp,
      last_claimed_at: timestamp,
      cycle_started_at: timestamp,
      can_claim_at: nil,
      saved_at: timestamp,
      progress_bar: %ProgressBar{
        reward_multiplier: 1.0,
        rewards_claimed: 0
      },
      charge_crystals: %__MODULE__.ChargeCrystals{},
      features: %Features{
        idle_mode_purchased: false,
        world_map_unlocked: false,
        sisu_generator_purchased: false,
        bonus_time_purchased: true
      },
      sisu: %Sisu{
        current: BigNum.one(),
        max_basic:
          BigNum.from_number(Incrementalist.Game.Features.Progress.Sisu.Levels.base_max()),
        target_current: BigNum.one(),
        active_tier: "azure",
        target_cycle_decay: Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay,
        max_upgrade_level: 0,
        cycle_decay: Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay,
        projected_at: timestamp
      },
      quests: [],
      achievements: %{},
      stats: %Stats{
        total_coins_earned: BigNum.zero(),
        total_shards_earned: BigNum.zero(),
        total_cores_earned: BigNum.zero(),
        last_reset_at: timestamp
      },
      daily_bonus: %DailyBonus{
        special_tokens: 0,
        last_token_boundary_index: 0,
        streak: 0,
        total_games_played: 0,
        reward_counts: %{
          "tier_1" => 0, "tier_2" => 0, "tier_3" => 0, "tier_4" => 0,
          "tier_5" => 0, "tier_6" => 0, "tier_7" => 0
        },
        checklist_entry_indexes: %{
          "resource" => 0, "item" => 0
        }
      }
    }
  end

  def check_daily_reset(%__MODULE__{} = state, now) do
    last_reset_str = state.stats.last_reset_at || state.first_played_at
    case Time.from_iso8601(last_reset_str) do
      {:ok, last_reset} ->
        if Date.compare(DateTime.to_date(last_reset), DateTime.to_date(now)) == :lt do
          new_stats = %{state.stats |
            total_level_ups_daily: 0,
            total_days_played: state.stats.total_days_played + 1,
            last_reset_at: Time.iso8601(now)
          }
          %{state | stats: new_stats}
        else
          state
        end
      _ -> state
    end
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
      "charge_crystals" =>
        Incrementalist.Game.Features.Progress.ChargeCrystals.visible_state(
          projected_state.charge_crystals
        ),
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
        "active_tier" =>
          if(projected_state.sisu, do: projected_state.sisu.active_tier || "azure", else: "azure"),
        "cycle_decay" =>
          if(projected_state.sisu,
            do: projected_state.sisu.cycle_decay || Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay,
            else: Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay
          )
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
      "quests" => visible_quests(projected_state.quests),
      "achievements" => visible_achievements(projected_state.achievements),
      "stats" => projected_state.stats,
      "has_daily_token" => projected_state.has_daily_token,
      "daily_bonus" => if(projected_state.daily_bonus, do: Map.from_struct(projected_state.daily_bonus), else: nil),
      "projection_params" =>
        projection_params(projected_state, now)
    }
  end

  def visible_quests(quests) do
    defs = Incrementalist.Game.Constants.quest_defs()
    for {id, quest_def} <- defs, into: %{} do
      q = Enum.find(quests, &(&1.id == id))
      {id,
       %{
         "name" => quest_def.name,
         "category" => quest_def.category,
         "rank" => if(q, do: q.rank, else: 0),
         "max_rank" => Enum.max(Map.keys(quest_def.ranks)),
         "progress" => if(q, do: q.progress, else: 0.0),
         "claimed_rank" => if(q, do: q.claimed_rank, else: 0)
       }}
    end
  end

  def visible_achievements(achievements) do
    defs = Incrementalist.Game.Constants.achievement_defs()
    for achievement_def <- defs, into: %{} do
      unlocked_at = Map.get(achievements || %{}, achievement_def.id)
      {achievement_def.id,
       %{
         "name" => achievement_def.name,
         "multiplier" => achievement_def.multiplier,
         "condition" => achievement_def.condition,
         "unlocked_at" => unlocked_at
       }}
    end
  end

  def projection_params(state, now) do
    can_claim_at = state.can_claim_at
    cycle_started_at = state.cycle_started_at

    current_fill =
      case {parse_iso_ms(cycle_started_at), parse_iso_ms(can_claim_at)} do
        {start_ms, end_ms} when is_integer(start_ms) and is_integer(end_ms) and end_ms > start_ms ->
          now_ms = Time.to_unix_ms(now)
          progress = (now_ms - start_ms) / (end_ms - start_ms)
          min(1.0, max(0.0, progress)) * 100.0

        _ ->
          0.0
      end

    %{
      "current_fill" => current_fill,
      "can_claim_at" => can_claim_at,
      "current_sisu" => state.sisu.current,
      "current_sisu_decay" => state.sisu.cycle_decay,
      "sisu_at_claim" => state.sisu.target_current,
      "sisu_decay_at_claim" => state.sisu.target_cycle_decay
    }
  end

  defp parse_iso_ms(iso) when is_binary(iso) do
    case Time.from_iso8601(iso) do
      {:ok, dt} -> Time.to_unix_ms(dt)
      _ -> nil
    end
  end

  defp parse_iso_ms(_), do: nil

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
