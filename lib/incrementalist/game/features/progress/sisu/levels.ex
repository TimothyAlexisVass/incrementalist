defmodule Incrementalist.Game.Features.Progress.Sisu.Levels do
  @moduledoc false

  @requirements_path Path.expand("../../../../../../shared/requirements/sisu.json", __DIR__)
  @external_resource @requirements_path
  @sisu @requirements_path |> File.read!() |> Jason.decode!()
  @refill_tiers Enum.map(@sisu["refill_tiers"], fn %{
                                                     "id" => id,
                                                     "label" => label,
                                                     "multiplier" => multiplier,
                                                     "cycle_decay" => cycle_decay
                                                   } ->
                  %{
                    id: id,
                    label: label,
                    multiplier: multiplier,
                    cycle_decay: cycle_decay
                  }
                end)
  @upgrade_costs Enum.map(@sisu["upgrade_costs"], fn %{"m" => m, "e" => e} ->
                   BigNum.normalize(%BigNum{m: m, e: e})
                 end)

  def base_max, do: @sisu["base_max"]
  def per_level, do: @sisu["per_level"]
  def refill_tiers, do: @refill_tiers

  def refill_tier(tier_id) when is_binary(tier_id) do
    Enum.find(@refill_tiers, fn tier -> tier.id == tier_id end)
  end

  def max_upgrade_level, do: length(@upgrade_costs) - 1

  def upgrade_cost(level) when is_integer(level) and level >= 0 do
    Enum.at(@upgrade_costs, level)
  end

  def upgrade_cost(_level), do: nil
end
