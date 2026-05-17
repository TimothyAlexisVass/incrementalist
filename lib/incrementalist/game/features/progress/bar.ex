defmodule Incrementalist.Game.Features.Progress.Bar do
  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.Progress.ChargeCrystals
  alias Incrementalist.Game.Features.Progress.Sisu
  alias Incrementalist.Game.State
  alias Incrementalist.Game.Time

  def set_idle_mode(%State{} = state, enabled) do
    if state.features.idle_mode_purchased do
      # Reset the bar on mode change as per user requirement
      {:ok, %{state | idle_mode: enabled, can_claim_at: nil, cycle_started_at: nil}}
    else
      {:error, "idle_mode_not_purchased"}
    end
  end

  def base_progress_bar_fill_rate(%State{} = state, _now) do
    idle_mode = state.idle_mode || false

    base_rate =
      if idle_mode do
        Constants.progress_bar_base_idle_mode_on_fill_rate()
      else
        Constants.progress_bar_base_idle_mode_off_fill_rate()
      end

    level = state.level || 1

    cond do
      level < 3 ->
        base_rate * Constants.progress_bar_new_player_bonus_fill_multiplier() +
          Constants.progress_bar_new_player_bonus_fill_bonus()

      level < 35 ->
        base_rate * Constants.progress_bar_late_new_player_bonus_fill_multiplier()

      true ->
        base_rate
    end
  end

  def get_progress_bar_fill_rate(%State{} = state, now) do
    base_progress_bar_fill_rate(state, now) * sisu_multiplier(state)
  end

  def ensure_can_claim_at(%State{} = state, now) do
    projected = Sisu.project_state(state, now)
    now_ms = Time.to_unix_ms(now)

    case parse_iso_ms(projected.can_claim_at) do
      can_claim_at_ms when is_integer(can_claim_at_ms) ->
        {projected, max(0, can_claim_at_ms - now_ms)}

      _ ->
        # This branch should theoretically not be reached now that project_state initializes it,
        # but we keep it for safety.
        ms_required = Sisu.claim_milliseconds(projected, now)
        claim_at = Time.iso8601(DateTime.add(now, ms_required, :millisecond))
        {%{projected | can_claim_at: claim_at, cycle_started_at: Time.iso8601(now)}, ms_required}
    end
  end

  def finalize_claim(%State{} = state, now) do
    progress_bar = state.progress_bar || %State.ProgressBar{}
    rewards_claimed = (progress_bar.rewards_claimed || 0) + 1
    updated_progress_bar = %{progress_bar | rewards_claimed: rewards_claimed}
    updated_charge_crystals = ChargeCrystals.grant_claim(state.charge_crystals, rewards_claimed)

    stats = state.stats || %State.Stats{}
    updated_stats = %{stats | total_progress_claims: stats.total_progress_claims + 1}

    %{
      state
      | progress_bar: updated_progress_bar,
        charge_crystals: updated_charge_crystals,
        stats: updated_stats,
        last_claimed_at: Time.iso8601(now),
        cycle_started_at: nil,
        can_claim_at: nil
    }
  end

  def claim_reward(%State{} = state, random_fn \\ &rand/0) do
    level = state.level || 1
    reward_multiplier = state.progress_bar.reward_multiplier || 1.0

    level_pow = :math.pow(level, 0.7)

    exp_base =
      cond do
        level < 10 -> level * 7
        level < 20 -> 33
        true -> 77
      end

    {exp_gain, coin_gain, shard_gain, core_gain} =
      if level == 1 do
        {BigNum.from_number(4), BigNum.from_number(500), BigNum.from_number(100),
         BigNum.from_number(20)}
      else
        exp = BigNum.from_number(trunc(exp_base * level_pow * reward_multiplier))

        variance = 0.8 + random_fn.() * 0.4
        coin = BigNum.from_number(trunc(35 * level_pow * reward_multiplier * variance))

        divisor = (4.0 + random_fn.() * 12.0) / 2.0
        {:ok, shard} = BigNum.div(coin, BigNum.from_number(divisor))

        c1 = if random_fn.() < 0.1, do: 1, else: 0
        c2 = if random_fn.() < 0.01, do: 10, else: 0
        core = BigNum.from_number(c1 + c2)

        {exp, coin, shard, core}
      end

    stats = state.stats || %State.Stats{}
    new_stats = %{stats |
      total_coins_earned: BigNum.add(stats.total_coins_earned || BigNum.zero(), coin_gain),
      total_shards_earned: BigNum.add(stats.total_shards_earned || BigNum.zero(), shard_gain),
      total_cores_earned: BigNum.add(stats.total_cores_earned || BigNum.zero(), core_gain)
    }

    %{
      state
      | exp: BigNum.add(state.exp || BigNum.zero(), exp_gain),
        coins: BigNum.add(state.coins || BigNum.zero(), coin_gain),
        shards: BigNum.add(state.shards || BigNum.zero(), shard_gain),
        cores: BigNum.add(state.cores || BigNum.zero(), core_gain),
        stats: new_stats
    }
  end

  defp sisu_multiplier(%State{} = state) do
    state.sisu.current
    |> case do
      %BigNum{} = current -> BigNum.to_float(current)
      _ -> 1.0
    end
    |> max(Constants.progress_bar_sisu_min_multiplier())
  end

  defp parse_iso_ms(iso) when is_binary(iso) do
    case Time.from_iso8601(iso) do
      {:ok, dt} -> Time.to_unix_ms(dt)
      _ -> nil
    end
  end

  defp parse_iso_ms(_), do: nil

  defp rand() do
    :rand.uniform()
  end
end
