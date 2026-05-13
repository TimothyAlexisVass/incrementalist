defmodule Incrementalist.Game.Features.Progress.ChargeCrystals do
  @moduledoc """
  Authoritative Charge Crystal inventory mutations.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.State

  def default, do: %State.ChargeCrystals{}

  def normalize(nil), do: default()
  def normalize(%State.ChargeCrystals{} = crystals), do: crystals
  def normalize(%{} = attrs), do: %State.ChargeCrystals{} |> State.ChargeCrystals.changeset(attrs) |> Ecto.Changeset.apply_changes()

  def visible_state(crystals), do: State.ChargeCrystals.visible_state(normalize(crystals))

  def count(crystals, tier_id) when is_binary(tier_id) do
    crystals = normalize(crystals)

    case tier_id do
      "azure" -> crystals.azure || 0
      "aether" -> crystals.aether || 0
      "lucent" -> crystals.lucent || 0
      "transcendent" -> crystals.transcendent || 0
      _ -> 0
    end
  end

  def grant_claim(crystals, rewards_claimed) when is_integer(rewards_claimed) and rewards_claimed > 0 do
    crystals
    |> normalize()
    |> add(:azure, claim_reward_amount(rewards_claimed, Constants.charge_crystal_azure_claim_interval()))
    |> add(:aether, claim_reward_amount(rewards_claimed, Constants.charge_crystal_aether_claim_interval()))
  end

  def grant_claim(crystals, _rewards_claimed), do: normalize(crystals)

  def grant_level_up(crystals, level) when is_integer(level) and level > 0 do
    crystals
    |> normalize()
    |> add(:lucent, milestone_reward(level, Constants.charge_crystal_lucent_level_interval()))
    |> add(:transcendent, milestone_reward(level, Constants.charge_crystal_transcendent_level_interval()))
  end

  def grant_level_up(crystals, _level), do: normalize(crystals)

  def spend(crystals, tier_id) when is_binary(tier_id) do
    crystals = normalize(crystals)

    case tier_id do
      "azure" -> spend_one(crystals, :azure)
      "aether" -> spend_one(crystals, :aether)
      "lucent" -> spend_one(crystals, :lucent)
      "transcendent" -> spend_one(crystals, :transcendent)
      _ -> {:error, "unknown_tier"}
    end
  end

  defp spend_one(crystals, field) do
    current = Map.get(crystals, field) || 0

    if current > 0 do
      {:ok, Map.put(crystals, field, current - 1)}
    else
      {:error, "insufficient_charge_crystals"}
    end
  end

  defp add(crystals, field, amount) when amount > 0 do
    current = Map.get(crystals, field) || 0
    Map.put(crystals, field, current + amount)
  end

  defp add(crystals, _field, _amount), do: crystals

  defp claim_reward_amount(rewards_claimed, interval) when interval > 0 do
    if rem(rewards_claimed, interval) == 0, do: 1, else: 0
  end

  defp milestone_reward(level, interval) when interval > 0 do
    if rem(level, interval) == 0, do: 1, else: 0
  end
end
