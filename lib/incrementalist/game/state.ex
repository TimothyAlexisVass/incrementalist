defmodule Incrementalist.Game.State do
  @moduledoc """
  Versioned save-state using Ecto embedded schemas.

  The persisted JSON can contain internal fields that are not part of the wire
  contract. Snapshots and save summaries are separate projections that include
  only data the player is allowed to render.
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Incrementalist.Game.{Climate, Constants, Time}
  alias Incrementalist.Game.Features.Orchard.Soil, as: OrchardSoil

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

  defmodule CloverHunt do
    use Ecto.Schema
    import Ecto.Changeset
    alias Incrementalist.Game.Constants

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :click_count, :integer, default: 0
      field :four_leaf_found_count, :integer, default: 0
      field :five_leaf_found_count, :integer, default: 0
      field :six_leaf_found, :boolean, default: false
      field :six_leaf_confirmed, :boolean, default: false
      field :seven_leaf_found, :boolean, default: false
      field :background_stage, :integer, default: 1
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      schema
      |> cast(attrs, [
        :click_count,
        :four_leaf_found_count,
        :five_leaf_found_count,
        :six_leaf_found,
        :six_leaf_confirmed,
        :seven_leaf_found,
        :background_stage
      ])
    end

    def visible_state(nil), do: visible_state(%__MODULE__{})

    def visible_state(%__MODULE__{} = clover_hunt) do
      %{
        "click_count" => clover_hunt.click_count || 0,
        "four_leaf_found_count" => clover_hunt.four_leaf_found_count || 0,
        "five_leaf_found_count" => clover_hunt.five_leaf_found_count || 0,
        "six_leaf_found" => clover_hunt.six_leaf_found || false,
        "six_leaf_confirmed" => clover_hunt.six_leaf_confirmed || false,
        "seven_leaf_found" => clover_hunt.seven_leaf_found || false,
        "background_stage" =>
          clover_hunt.background_stage
          |> Kernel.||(1)
          |> min(Constants.clover_hunt_max_background_stage())
          |> max(1)
      }
    end
  end

  defmodule Furnace do
    use Ecto.Schema
    import Ecto.Changeset

    defmodule BurnBatch do
      use Ecto.Schema
      import Ecto.Changeset

      @primary_key false
      @derive Jason.Encoder
      embedded_schema do
        embeds_one :amount, BigNum, on_replace: :update
        field :available_at, :string
      end

      def changeset(schema \\ %__MODULE__{}, attrs) do
        schema
        |> cast(attrs, [:available_at])
        |> cast_embed(:amount)
      end
    end

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      embeds_many :burn_batches, BurnBatch, on_replace: :delete
      field :projected_at, :string
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:projected_at])
      |> cast_embed(:burn_batches)
    end

    def remaining_burn_queue(%__MODULE__{} = furnace) do
      Enum.reduce(furnace.burn_batches || [], BigNum.zero(), fn batch, total ->
        case batch.amount do
          %BigNum{} = amount -> BigNum.add(total, amount)
          _ -> total
        end
      end)
    end

    def append_burn_batch(%__MODULE__{} = furnace, %BigNum{} = amount, available_at)
        when is_binary(available_at) do
      %{
        furnace
        | burn_batches:
            (furnace.burn_batches || []) ++
              [%BurnBatch{amount: amount, available_at: available_at}]
      }
    end
  end

  defmodule Soil do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :water_level, :float, default: 0.0
      embeds_one :nitrogen, BigNum, on_replace: :update
      embeds_one :phosphorus, BigNum, on_replace: :update
      embeds_one :potassium, BigNum, on_replace: :update
      embeds_one :organic_matter, BigNum, on_replace: :update
      field :projected_at, :string
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:water_level, :projected_at])
      |> cast_embed(:nitrogen)
      |> cast_embed(:phosphorus)
      |> cast_embed(:potassium)
      |> cast_embed(:organic_matter)
    end
  end

  defmodule Plant do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :plant_id, :string
      field :growth, :float, default: 0.0
      field :level, :integer, default: 1
      field :planted_at, :string
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:plant_id, :growth, :level, :planted_at])
    end
  end

  defmodule Decomposition do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :resource_id, :string
      embeds_one :amount, BigNum, on_replace: :update
      field :progress, :float, default: 0.0
      field :plant_type, :string
      field :started_at, :string
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:resource_id, :progress, :started_at, :plant_type])
      |> cast_embed(:amount)
    end
  end

  defmodule Plot do
    use Ecto.Schema
    import Ecto.Changeset

    @primary_key false
    @derive Jason.Encoder
    embedded_schema do
      field :id, :string
      field :depth, :integer, default: 1
      embeds_one :plant, Incrementalist.Game.State.Plant, on_replace: :update
      embeds_one :decomposition, Incrementalist.Game.State.Decomposition, on_replace: :update
    end

    def changeset(schema \\ %__MODULE__{}, attrs) do
      cast(schema, attrs, [:id, :depth])
      |> cast_embed(:plant)
      |> cast_embed(:decomposition)
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
      field :total_favor, :integer, default: 0
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
        :total_favor,
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

  defmodule BonusTime do
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

      field :reward_counts, :map,
        default: %{
          "tier_1" => 0,
          "tier_2" => 0,
          "tier_3" => 0,
          "tier_4" => 0,
          "tier_5" => 0,
          "tier_6" => 0,
          "tier_7" => 0
        }

      field :checklist_entry_indexes, :map,
        default: %{
          "resource" => 0,
          "item" => 0
        }

      field :last_result, :map
      field :jackpot_progress, :integer, default: 0
      field :bonustime_flips, :integer, virtual: true, default: 0

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
        :last_result,
        :jackpot_progress,
        :bonustime_flips
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
    field :furnace_level, :integer, default: 1
    field :has_bonustime_token, :boolean, default: true

    embeds_one :exp, BigNum, on_replace: :update
    embeds_one :required_exp, BigNum, on_replace: :update
    embeds_one :fame, BigNum, on_replace: :update
    embeds_one :required_fame, BigNum, on_replace: :update
    embeds_one :coins, BigNum, on_replace: :update
    embeds_one :shards, BigNum, on_replace: :update
    embeds_one :cores, BigNum, on_replace: :update
    field :trust, :integer, default: 1

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
    embeds_one :clover_hunt, CloverHunt, on_replace: :update
    embeds_one :soil, Soil, on_replace: :update
    embeds_one :furnace, Furnace, on_replace: :update

    field :unlocked_plots, {:array, :string}, default: ["plot_1"]
    field :spliced_seeds, {:array, :string}, default: []

    embeds_one :wood, BigNum, on_replace: :update
    embeds_one :plant_matter, BigNum, on_replace: :update
    embeds_one :ash, BigNum, on_replace: :update
    embeds_one :charcoal, BigNum, on_replace: :update
    embeds_one :clover_seeds, BigNum, on_replace: :update
    embeds_one :acorns, BigNum, on_replace: :update
    embeds_one :coin_tree_seeds, BigNum, on_replace: :update

    embeds_many :plots, Incrementalist.Game.State.Plot, on_replace: :delete
    embeds_many :quests, __MODULE__.QuestState, on_replace: :delete
    embeds_one :stats, __MODULE__.Stats, on_replace: :update
    embeds_one :bonustime, __MODULE__.BonusTime, on_replace: :update
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
      :furnace_level,
      :has_bonustime_token,
      :trust,
      :idle_mode,
      :first_played_at,
      :last_claimed_at,
      :cycle_started_at,
      :can_claim_at,
      :saved_at,
      :achievements,
      :unlocked_plots,
      :spliced_seeds
    ])
    |> cast_embed(:exp)
    |> cast_embed(:required_exp)
    |> cast_embed(:fame)
    |> cast_embed(:required_fame)
    |> cast_embed(:coins)
    |> cast_embed(:shards)
    |> cast_embed(:cores)
    |> cast_embed(:progress_bar)
    |> cast_embed(:charge_crystals)
    |> cast_embed(:features)
    |> cast_embed(:sisu)
    |> cast_embed(:clover_hunt)
    |> cast_embed(:soil)
    |> cast_embed(:furnace)
    |> cast_embed(:wood)
    |> cast_embed(:plant_matter)
    |> cast_embed(:ash)
    |> cast_embed(:charcoal)
    |> cast_embed(:clover_seeds)
    |> cast_embed(:acorns)
    |> cast_embed(:coin_tree_seeds)
    |> cast_embed(:plots)
    |> cast_embed(:quests)
    |> cast_embed(:stats)
    |> cast_embed(:bonustime)
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
    |> maybe_put_embed(:fame)
    |> maybe_put_embed(:required_fame)
    |> maybe_put_embed(:coins)
    |> maybe_put_embed(:shards)
    |> maybe_put_embed(:cores)
    |> maybe_put_embed(:progress_bar)
    |> maybe_put_embed(:charge_crystals)
    |> maybe_put_embed(:features)
    |> maybe_put_embed(:sisu)
    |> maybe_put_embed(:clover_hunt)
    |> maybe_put_embed(:soil)
    |> maybe_put_embed(:furnace)
    |> maybe_put_embed(:quests)
    |> maybe_put_embed(:stats)
    |> maybe_put_embed(:bonustime)
    |> maybe_put_embed(:wood)
    |> maybe_put_embed(:plant_matter)
    |> maybe_put_embed(:ash)
    |> maybe_put_embed(:charcoal)
    |> maybe_put_embed(:clover_seeds)
    |> maybe_put_embed(:acorns)
    |> maybe_put_embed(:coin_tree_seeds)
    |> maybe_put_embed(:plots)
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
      furnace_level: 1,
      has_bonustime_token: true,
      exp: BigNum.zero(),
      required_exp: BigNum.from_number(20),
      fame: BigNum.zero(),
      required_fame: BigNum.from_number(20),
      coins: BigNum.zero(),
      shards: BigNum.zero(),
      cores: BigNum.zero(),
      trust: 1,
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
        bonus_time_purchased: false
      },
      sisu: %Sisu{
        current: BigNum.one(),
        max_basic:
          BigNum.from_number(Incrementalist.Game.Features.Progress.Sisu.Levels.base_max()),
        target_current: BigNum.one(),
        active_tier: "azure",
        target_cycle_decay:
          Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay,
        max_upgrade_level: 0,
        cycle_decay:
          Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay,
        projected_at: timestamp
      },
      clover_hunt: %CloverHunt{},
      soil: %Soil{
        water_level: Constants.orchard_soil_default_water_level(),
        nitrogen: Constants.orchard_soil_default_nitrogen(),
        phosphorus: Constants.orchard_soil_default_phosphorus(),
        potassium: Constants.orchard_soil_default_potassium(),
        organic_matter: Constants.orchard_soil_default_organic_matter(),
        projected_at: utc_minute_boundary_iso(now)
      },
      furnace: %Furnace{
        burn_batches: [],
        projected_at: utc_minute_boundary_iso(now)
      },
      unlocked_plots: ["plot_1"],
      spliced_seeds: [],
      wood: BigNum.zero(),
      plant_matter: BigNum.zero(),
      ash: BigNum.zero(),
      charcoal: BigNum.zero(),
      clover_seeds: BigNum.from_number(50),
      acorns: BigNum.zero(),
      coin_tree_seeds: BigNum.zero(),
      plots: [
        %Plot{id: "plot_1", depth: 1}
      ],
      quests: [],
      achievements: %{},
      stats: %Stats{
        total_coins_earned: BigNum.zero(),
        total_shards_earned: BigNum.zero(),
        total_cores_earned: BigNum.zero(),
        last_reset_at: timestamp
      },
      bonustime: %BonusTime{
        special_tokens: 0,
        last_token_boundary_index: 0,
        streak: 0,
        total_games_played: 0,
        reward_counts: %{
          "tier_1" => 0,
          "tier_2" => 0,
          "tier_3" => 0,
          "tier_4" => 0,
          "tier_5" => 0,
          "tier_6" => 0,
          "tier_7" => 0
        },
        checklist_entry_indexes: %{
          "resource" => 0,
          "item" => 0
        },
        jackpot_progress: 0
      }
    }
  end

  def check_daily_reset(%__MODULE__{} = state, now) do
    last_reset_str = state.stats.last_reset_at || state.first_played_at

    case Time.from_iso8601(last_reset_str) do
      {:ok, last_reset} ->
        if Date.compare(DateTime.to_date(last_reset), DateTime.to_date(now)) == :lt do
          new_stats = %{
            state.stats
            | total_level_ups_daily: 0,
              total_days_played: state.stats.total_days_played + 1,
              last_reset_at: Time.iso8601(now)
          }

          %{state | stats: new_stats}
        else
          state
        end

      _ ->
        state
    end
  end

  def has_bonustime_token_available?(%__MODULE__{} = state, now) do
    state.has_bonustime_token ||
      bonustime_boundary_index(now) > bonustime_last_boundary_index(state)
  end

  def consume_bonustime_daily_token(%__MODULE__{} = state, now) do
    bonustime = state.bonustime || %BonusTime{}
    boundary_index = bonustime_boundary_index(now)
    last_boundary_index = bonustime.last_token_boundary_index || 0

    new_bonustime = %{
      bonustime
      | last_token_boundary_index: max(last_boundary_index, boundary_index)
    }

    %{state | has_bonustime_token: false, bonustime: new_bonustime}
  end

  def touch_saved_at(nil, now), do: new(now)

  def touch_saved_at(%__MODULE__{} = state, now) do
    %{state | saved_at: Time.iso8601(now)}
  end

  def visible_plots(plots) do
    Enum.map(plots || [], fn p ->
      %{
        "id" => p.id,
        "depth" => p.depth,
        "plant" =>
          if(p.plant,
            do: %{
              "plant_id" => p.plant.plant_id,
              "growth" => p.plant.growth,
              "level" => p.plant.level,
              "planted_at" => p.plant.planted_at
            },
            else: nil
          ),
        "decomposition" =>
          if(p.decomposition,
            do: %{
              "resource_id" => p.decomposition.resource_id,
              "amount" => p.decomposition.amount,
              "progress" => p.decomposition.progress,
              "plant_type" => p.decomposition.plant_type
            },
            else: nil
          )
      }
    end)
  end

  def visible_state(nil, now), do: visible_state(new(now), now)

  def visible_state(%__MODULE__{} = state, now) do
    projected_state =
      state
      |> Incrementalist.Game.Features.Progress.Sisu.project_state(now)
      |> OrchardSoil.project_state(now)

    %{
      "area" => projected_state.area || "sage",
      "level" => projected_state.level || 1,
      "furnace_level" => projected_state.furnace_level || 1,
      "trust" => projected_state.trust || 1,
      "exp" => projected_state.exp || BigNum.zero(),
      "required_exp" => projected_state.required_exp || BigNum.from_number(20),
      "fame" => projected_state.fame || BigNum.zero(),
      "required_fame" => projected_state.required_fame || BigNum.from_number(20),
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
            do:
              projected_state.sisu.cycle_decay ||
                Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay,
            else:
              Incrementalist.Game.Features.Progress.Sisu.Levels.refill_tier("azure").cycle_decay
          )
      },
      "areas" => Incrementalist.Game.Features.Areas.visible_area_defs(projected_state),
      "features" => %{
        "idle_mode_purchased" => projected_state.features.idle_mode_purchased,
        "world_map_unlocked" => projected_state.features.world_map_unlocked,
        "sisu_generator_purchased" => projected_state.features.sisu_generator_purchased,
        "bonus_time_purchased" => projected_state.features.bonus_time_purchased
      },
      "climate" => Climate.visible_state(now),
      "clover_hunt" => CloverHunt.visible_state(projected_state.clover_hunt),
      "soil" => OrchardSoil.visible_state(projected_state.soil),
      "furnace" => %{
        "burn_queue" => Furnace.remaining_burn_queue(projected_state.furnace),
        "projected_at" => projected_state.furnace.projected_at
      },
      "unlocked_plots" => projected_state.unlocked_plots || ["plot_1"],
      "spliced_seeds" => projected_state.spliced_seeds || [],
      "wood" => projected_state.wood || BigNum.zero(),
      "plant_matter" => projected_state.plant_matter || BigNum.zero(),
      "ash" => projected_state.ash || BigNum.zero(),
      "charcoal" => projected_state.charcoal || BigNum.zero(),
      "clover_seeds" => projected_state.clover_seeds || BigNum.zero(),
      "acorns" => projected_state.acorns || BigNum.zero(),
      "coin_tree_seeds" => projected_state.coin_tree_seeds || BigNum.zero(),
      "plots" => visible_plots(projected_state.plots),
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
      "has_bonustime_token" => has_bonustime_token_available?(projected_state, now),
      "bonustime" =>
        if(projected_state.bonustime,
          do:
            Map.merge(Map.from_struct(projected_state.bonustime), %{
              "active_game_id" =>
                Incrementalist.Game.Features.BonusTime.Rules.get_active_game_id()
            }),
          else: nil
        ),
      "projection_params" => projection_params(projected_state, now)
    }
  end

  defp bonustime_boundary_index(%DateTime{} = now) do
    anchor_ms = Constants.bonustime_rotation_anchor_at() |> Time.to_unix_ms()
    now_ms = Time.to_unix_ms(now)
    elapsed = max(0, now_ms - anchor_ms)
    div(elapsed, Constants.bonustime_slot_ms())
  end

  defp bonustime_last_boundary_index(%__MODULE__{} = state) do
    if state.bonustime do
      state.bonustime.last_token_boundary_index || 0
    else
      0
    end
  end

  def visible_quests(quests) do
    defs = Incrementalist.Game.Constants.quest_defs()

    for {id, quest_def} <- defs, into: %{} do
      q = Enum.find(quests, &(&1.id == id))
      claimed_rank = if(q, do: q.claimed_rank, else: 0)
      max_rank = Enum.max(Map.keys(quest_def.ranks))

      active_rank = min(claimed_rank + 1, max_rank)
      active_rank_def = quest_def.ranks[active_rank]

      fame =
        case active_rank_def do
          nil -> BigNum.zero()
          rank_def -> rank_def.fame
        end

      favor =
        case active_rank_def do
          nil -> 0
          rank_def -> rank_def.favor || 1
        end

      requirement =
        case active_rank_def do
          nil -> 0
          rank_def -> rank_def.requirement
        end

      {id,
       %{
         "name" => quest_def.name,
         "category" => quest_def.category,
         "rank" => if(q, do: q.rank, else: 0),
         "max_rank" => max_rank,
         "progress" => if(q, do: q.progress, else: 0.0),
         "claimed_rank" => claimed_rank,
         "requirement" => requirement,
         "text" => quest_def.text,
         "fame" => fame,
         "favor" => favor
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
         "condition_text" => achievement_def.condition_text,
         "favor" => achievement_def.favor || 1,
         "unlocked_at" => unlocked_at
       }}
    end
  end

  def projection_params(state, now) do
    can_claim_at = state.can_claim_at
    cycle_started_at = state.cycle_started_at

    current_fill =
      case {parse_iso_ms(cycle_started_at), parse_iso_ms(can_claim_at)} do
        {start_ms, end_ms}
        when is_integer(start_ms) and is_integer(end_ms) and end_ms > start_ms ->
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

  defp utc_minute_boundary_iso(%DateTime{} = now) do
    now
    |> Time.to_unix_ms()
    |> div(60_000)
    |> Kernel.*(60_000)
    |> DateTime.from_unix!(:millisecond)
    |> Time.iso8601()
  end
end
