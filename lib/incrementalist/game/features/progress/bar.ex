defmodule Incrementalist.Game.Features.Progress.Bar do
  alias Incrementalist.Game.Time

  @new_player_bonus_window_ms 25_000
  @new_player_bonus_fill_multiplier 2.5
  @new_player_bonus_fill_bonus 20.0
  @late_new_player_bonus_fill_multiplier 7.25
  @base_idle_mode_off_fill_rate 0.8
  @base_idle_mode_on_fill_rate 0.24
  @sisu_min_multiplier 1.0
  @max_fill 100.0

  def get_progress_bar_fill_rate(state, now) do
    progress_bar = Map.get(state, "progress_bar", %{})
    sisu = Map.get(progress_bar, "sisu", 1) |> max(@sisu_min_multiplier)
    idle_mode = Map.get(state, "idle_mode", false)

    base_rate =
      if idle_mode do
        @base_idle_mode_on_fill_rate * sisu
      else
        @base_idle_mode_off_fill_rate * sisu
      end

    if idle_mode do
      base_rate
    else
      first_played_at_ms =
        case Map.get(state, "first_played_at") do
          nil -> Time.to_unix_ms(now)
          iso_str ->
            case Time.from_iso8601(iso_str) do
              {:ok, dt} -> Time.to_unix_ms(dt)
              _ -> Time.to_unix_ms(now)
            end
        end

      now_ms = Time.to_unix_ms(now)
      game_age_ms = now_ms - first_played_at_ms

      level = Map.get(state, "level", 1)

      cond do
        game_age_ms < @new_player_bonus_window_ms ->
          (base_rate * @new_player_bonus_fill_multiplier) + @new_player_bonus_fill_bonus

        level < 35 ->
          base_rate * @late_new_player_bonus_fill_multiplier

        true ->
          base_rate
      end
    end
  end

  def can_claim_in(state, now) do
    {_state, can_claim_in} = ensure_can_claim_at(state, now)
    can_claim_in
  end

  def ensure_can_claim_at(state, now) do
    rate = get_progress_bar_fill_rate(state, now)
    ms_required = if rate > 0, do: trunc(@max_fill * 1000 / rate), else: 0

    can_claim_at_iso = Map.get(state, "can_claim_at")
    {state, can_claim_at_ms} =
      case parse_iso_ms(can_claim_at_iso) do
        {:ok, claim_at_ms} ->
          {state, claim_at_ms}

        :error ->
          claim_at = Time.iso8601(DateTime.add(now, ms_required, :millisecond))
          {Map.put(state, "can_claim_at", claim_at), Time.to_unix_ms(DateTime.add(now, ms_required, :millisecond))}
      end

    now_ms = Time.to_unix_ms(now)
    {state, max(0, can_claim_at_ms - now_ms)}
  end

  def calculate_next_can_claim_at(state, now) do
    rate = get_progress_bar_fill_rate(state, now)
    ms_required = if rate > 0, do: trunc(@max_fill * 1000 / rate), else: 0
    Time.iso8601(DateTime.add(now, ms_required, :millisecond))
  end

  def claim_ready?(state, now, tolerance_ms \\ 0) do
    {_state, can_claim_in} = ensure_can_claim_at(state, now)
    can_claim_in <= tolerance_ms
  end

  def finalize_claim(state, now) do
    progress_bar = Map.get(state, "progress_bar", %{})
    rewards_claimed = Map.get(progress_bar, "rewards_claimed", 0) + 1
    updated_progress_bar = Map.put(progress_bar, "rewards_claimed", rewards_claimed)

    state
    |> Map.put("progress_bar", updated_progress_bar)
    |> Map.put("last_claimed_at", Time.iso8601(now))
    |> Map.put("can_claim_at", nil)
  end

  def claim_reward(state, random_fn \\ &rand/0) do
    progress_bar = Map.get(state, "progress_bar", %{})
    sisu = Map.get(progress_bar, "sisu", 1) |> max(@sisu_min_multiplier)
    level = Map.get(state, "level", 1)
    idle_mode = Map.get(state, "idle_mode", false)
    reward_multiplier = Map.get(progress_bar, "reward_multiplier", 1.0)

    level_pow = :math.pow(level, 0.7)

    exp_base =
      cond do
        level < 10 -> level * 7
        level < 20 -> 33
        true -> 77
      end

    {exp_gain, coin_gain, shard_gain, core_gain} =
      if level == 1 do
        {4, 500, 100, 20}
      else
        exp = trunc(exp_base * sisu * level_pow * reward_multiplier)

        variance = 0.8 + random_fn.() * 0.4
        coin = trunc(35 * sisu * level_pow * reward_multiplier * variance)

        idle_mult = if idle_mode, do: 1, else: 2
        shard = trunc((coin / (4.0 + random_fn.() * 12.0)) * idle_mult)

        core =
          if not idle_mode do
            c1 = if random_fn.() < 0.1, do: 1, else: 0
            c2 = if random_fn.() < 0.01, do: 10, else: 0
            c1 + c2
          else
            0
          end

        {exp, coin, shard, core}
      end

    state =
      state
      |> Map.put("exp", Map.get(state, "exp", 0) + exp_gain)
      |> Map.put("coins", Map.get(state, "coins", 0) + coin_gain)
      |> Map.put("shards", Map.get(state, "shards", 0) + shard_gain)
      |> Map.put("cores", Map.get(state, "cores", 0) + core_gain)

    state
  end

  defp rand() do
    :rand.uniform()
  end

  defp parse_iso_ms(iso) when is_binary(iso) do
    case Time.from_iso8601(iso) do
      {:ok, dt} -> {:ok, Time.to_unix_ms(dt)}
      _ -> :error
    end
  end

  defp parse_iso_ms(_), do: :error
end
