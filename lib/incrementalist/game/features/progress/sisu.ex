defmodule Incrementalist.Game.Features.Progress.Sisu do
  @moduledoc """
  Authoritative Sisu state mutations and cycle projections.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.Progress.ChargeCrystals
  alias Incrementalist.Game.Features.Progress.Bar
  alias Incrementalist.Game.Features.Progress.Sisu.Levels
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Time
  def refill_tiers, do: Levels.refill_tiers()

  def max_basic_for_level(level) do
    Levels.base_max() + normalize_level(level) * Levels.per_level()
  end

  def max_effective_for_level(level) do
    tier_target_for_level(level, List.last(tier_ids()))
  end

  def tier_target_for_level(level_or_state, tier_id) do
    max_basic =
      case level_or_state do
        %State{} = state -> max_basic_from_state(state)
        level when is_number(level) -> max_basic_for_level(level)
      end

    tier = tier(tier_id)
    Float.round(max_basic * tier.multiplier, 2)
  end

  def tier(tier_id) do
    Levels.refill_tier(tier_id) || List.first(Levels.refill_tiers())
  end

  def tier?(tier_id) do
    Enum.any?(Levels.refill_tiers(), fn tier -> tier.id == tier_id end)
  end

  def tier_ids, do: Enum.map(Levels.refill_tiers(), & &1.id)

  def upgrade_cost(level) do
    Levels.upgrade_cost(level)
  end

  def can_purchase_upgrade(%State{} = state) do
    if not purchased?(state) do
      {:error, "sisu_generator_not_purchased"}
    else
      current_level =
        case state.sisu do
          %{} = sisu -> sisu.max_upgrade_level || 0
          _ -> 0
        end

      if current_level >= Levels.max_upgrade_level() do
        {:error, "sisu_max_upgrade_reached"}
      else
        case upgrade_cost(current_level + 1) do
          nil ->
            {:error, "upgrade_cost_missing"}

          cost ->
            if BigNum.compare(state.shards || BigNum.zero(), cost) >= 0 do
              {:ok, cost}
            else
              {:error, "insufficient_shards"}
            end
        end
      end
    end
  end

  def initialize_generator(%State{} = state, now) do
    next_sisu = state.sisu || default_sisu()

    updated_sisu =
      next_sisu
      |> Map.put(:current, BigNum.one())
      |> Map.put(:max_basic, BigNum.from_number(Levels.base_max()))
      |> Map.put(:max_upgrade_level, 0)
      |> Map.put(:active_tier, "azure")
      |> Map.put(:cycle_decay, azure_cycle_decay())
      |> Map.put(:projected_at, Time.iso8601(now))

    project_projection(%{state | sisu: updated_sisu}, now)
  end

  def refill(%State{} = state, tier_id, now) do
    projected = project_state(state, now)
    tier = tier(tier_id)
    target = tier_target_for_level(projected, tier.id)
    authoritative_current = current_sisu(projected, now)
    target_current = projected.sisu.target_current || authoritative_current
    effective_max = max_effective_from_state(projected)

    # A charge is pending if the target for the next cycle is higher than current
    is_pending = BigNum.compare(target_current, authoritative_current) > 0
    threshold = target * 0.8

    cond do
      is_pending ->
        {:error, "sisu_charge_pending"}

      BigNum.compare(authoritative_current, BigNum.from_number(threshold)) >= 0 ->
        {:error, "sisu_already_higher"}

      true ->
      with {:ok, updated_charge_crystals} <- ChargeCrystals.spend(projected.charge_crystals, tier.id) do
        next_sisu = BigNum.from_number(min(effective_max, target))

        updated_sisu =
          projected.sisu
          |> Map.put(:target_current, next_sisu)
          |> Map.put(:target_cycle_decay, tier.cycle_decay)
          |> Map.put(:active_tier, tier.id)
          |> Map.put(:projected_at, Time.iso8601(now))

        {:ok,
         %{projected | sisu: updated_sisu, charge_crystals: updated_charge_crystals}}
      end
    end
  end

  def upgrade_max(%State{} = state, now) do
    projected = project_state(state, now)

    with {:ok, cost} <- can_purchase_upgrade(projected) do
      current_level = (projected.sisu && (projected.sisu.max_upgrade_level || 0)) || 0
      next_level = current_level + 1
      next_max_basic = max_basic_for_level(next_level)

      updated_sisu =
        projected.sisu
        |> Map.put(:max_basic, BigNum.from_number(next_max_basic))
        |> Map.put(:max_upgrade_level, next_level)
        |> Map.put(:projected_at, Time.iso8601(now))

      updated =
        projected
        |> Map.put(:shards, BigNum.sub(projected.shards || BigNum.zero(), cost))
        |> Map.put(:sisu, updated_sisu)

      {:ok, project_projection(updated, now)}
    end
  end

  def advance_cycle(%State{} = state, now) do
    if state.sisu do
      # Move targets to current state for the new cycle
      updated_sisu =
        state.sisu
        |> Map.put(:current, state.sisu.target_current || state.sisu.current)
        |> Map.put(:cycle_decay, state.sisu.target_cycle_decay || state.sisu.cycle_decay)
        |> Map.put(:target_current, nil)
        |> Map.put(:target_cycle_decay, nil)
        |> Map.put(:projected_at, Time.iso8601(now))

      project_projection(%{state | sisu: updated_sisu}, now)
    else
      state
    end
  end

  def project_state(%State{} = state, now) do
    if state.sisu do
      normalized_sisu = normalize_sisu(state.sisu)

      %{state | sisu: normalized_sisu}
      |> project_projection(now)
    else
      state
    end
  end

  def project_projection(%State{} = state, now) do
    if state.sisu do
      # If targets are not set, calculate default decay targets
      {default_target_sisu, default_target_decay} = next_cycle_values(state)

      updated_sisu =
        state.sisu
        |> Map.put(:target_current, state.sisu.target_current || default_target_sisu)
        |> Map.put(:target_cycle_decay, state.sisu.target_cycle_decay || default_target_decay)

      case state.can_claim_at do
        nil ->
          claim_at = can_claim_at(state, now)
          %{state | sisu: updated_sisu, can_claim_at: claim_at, cycle_started_at: Time.iso8601(now)}

        _existing ->
          %{state | sisu: updated_sisu}
      end
    else
      state
    end
  end

  def can_claim_at(%State{} = state, now) do
    ms = claim_milliseconds(state, now)
    Time.iso8601(DateTime.add(now, ms, :millisecond))
  end

  def claim_milliseconds(%State{} = state, now) do
    fill_rate = Bar.get_progress_bar_fill_rate(state, now)
    ms = Constants.progress_bar_max_fill() / max(fill_rate, 0.000001) * 1000.0
    max(0, trunc(Float.ceil(ms)))
  end

  def current_sisu(%State{} = state, _now \\ Time.now()) do
    state
    |> current_sisu_from_state()
    |> min_clamped_multiplier()
  end

  def claim_seconds(%State{} = state, now) do
    div(claim_milliseconds(state, now) + 999, 1000)
  end

  def claim_seconds(current_sisu, base_rate, _cycle_decay)
      when is_number(current_sisu) and is_number(base_rate) do
    effective_rate =
      max(base_rate, 0.000001) * max(current_sisu, Constants.progress_bar_sisu_min_multiplier())

    max(1, trunc(Float.ceil(Constants.progress_bar_max_fill() / effective_rate)))
  end

  defp purchased?(%State{} = state) do
    state.features && state.features.sisu_generator_purchased
  end

  defp normalize_level(level) when is_integer(level), do: max(0, level)
  defp normalize_level(level) when is_float(level), do: max(0, trunc(level))
  defp normalize_level(_), do: 0

  defp normalize_sisu(sisu) do
    current =
      case sisu.current do
        %BigNum{} = value -> value
        _ -> BigNum.from_number(Constants.progress_bar_sisu_min_multiplier())
      end
      |> min_clamped_multiplier()

    max_basic =
      case sisu.max_basic do
        %BigNum{} = value -> BigNum.from_number(max(BigNum.to_float(value), Levels.base_max()))
        _ -> BigNum.from_number(Levels.base_max())
      end

    cycle_decay = max(0.0, sisu.cycle_decay || azure_cycle_decay())

    sisu
    |> Map.put(:current, current)
    |> Map.put(:max_basic, max_basic)
    |> Map.put(:max_upgrade_level, normalize_level(sisu.max_upgrade_level || 0))
    |> Map.put(:active_tier, normalize_tier_id(sisu.active_tier))
    |> Map.put(:cycle_decay, cycle_decay)
  end

  defp max_basic_from_state(%State{} = state) do
    case state.sisu do
      %{} = sisu ->
        case sisu.max_basic do
          %BigNum{} = value -> BigNum.to_float(value)
          _ -> Levels.base_max()
        end

      _ ->
        Levels.base_max()
    end
  end

  defp max_effective_from_state(%State{} = state) do
    tier_target_for_level(state, List.last(tier_ids()))
  end

  defp current_sisu_from_state(%State{} = state) do
    case state.sisu do
      %{} = sisu ->
        case sisu.current do
          %BigNum{} = value -> value
          _ -> BigNum.from_number(Constants.progress_bar_sisu_min_multiplier())
        end

      _ ->
        BigNum.from_number(Constants.progress_bar_sisu_min_multiplier())
    end
  end

  defp current_cycle_decay_from_state(%State{} = state) do
    case state.sisu do
      %{} = sisu -> max(0.0, sisu.cycle_decay || azure_cycle_decay())
      _ -> azure_cycle_decay()
    end
  end

  defp next_cycle_values(%State{} = state) do
    current = current_sisu_from_state(state) |> min_clamped_multiplier()
    cycle_decay = current_cycle_decay_from_state(state)
    apply_decay_step(current, cycle_decay)
  end

  defp apply_decay_step(%BigNum{} = current_sisu, cycle_decay_percent) do
    bounded_cycle_decay = cycle_decay_percent |> max(0.0) |> min(100.0)

    decay_factor = BigNum.from_number(1.0 - bounded_cycle_decay / 100.0)

    decayed_sisu =
      current_sisu
      |> BigNum.mul(decay_factor)
      |> min_clamped_multiplier()

    softened_cycle_decay =
      max(0.0, cycle_decay_percent * Constants.sisu_diminishment_reduction_factor_per_cycle())

    {decayed_sisu, softened_cycle_decay}
  end

  defp min_clamped_multiplier(%BigNum{} = value) do
    minimum = BigNum.from_number(Constants.progress_bar_sisu_min_multiplier())

    if BigNum.compare(value, minimum) < 0 do
      minimum
    else
      value
    end
  end

  defp default_sisu do
    %{
      current: BigNum.one(),
      max_basic: BigNum.from_number(Levels.base_max()),
      max_upgrade_level: 0,
      active_tier: "azure",
      cycle_decay: azure_cycle_decay(),
      projected_at: nil
    }
  end

  defp normalize_tier_id(tier_id) when is_binary(tier_id) do
    if tier?(tier_id), do: tier_id, else: "azure"
  end

  defp normalize_tier_id(_), do: "azure"

  defp azure_cycle_decay do
    Levels.refill_tier("azure").cycle_decay
  end
end
