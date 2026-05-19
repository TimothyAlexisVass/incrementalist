defmodule Incrementalist.Game.Features.BonusTime.Games.CoinRain do
  @moduledoc """
  Coin Rain mini-game rules.

  Secure two-step simulation:
  1. The server generates a deterministic seed, timer, bucket speed, and width.
  2. The client runs the exact same spawn sequence using a deterministic LCG.
  3. The client sends the recorded bucket path, and the server replays the physics to verify rewards.
  """
  alias Incrementalist.Game.Constants

  def roll_reward(streak) do
    # Retained as fallback or test compatibility
    rules = Constants.bonustime_game_rules()["coin_rain"]
    chances = rules["chances"]
    scaling = rules["streak_scaling"]
    bonus_rolls = min(scaling["max_bonus"], div(streak, scaling["interval"]))
    roll_count = 1 + bonus_rolls

    rolls = Enum.map(1..roll_count, fn _ -> generate_roll(chances) end)
    best_tier_index = Enum.max(rolls)
    {best_tier_index + 1, rolls |> Enum.map(&(&1 + 1))}
  end

  defp generate_roll(chances) do
    r = :rand.uniform()

    {_, index} =
      Enum.reduce_while(chances, {0.0, 0}, fn chance, {acc, idx} ->
        new_acc = acc + chance

        if r <= new_acc do
          {:halt, {new_acc, idx}}
        else
          {:cont, {new_acc, idx + 1}}
        end
      end)

    index
  end

  # ============================================================================
  # Secure Two-Step Simulation Engine
  # ============================================================================

  @doc """
  Generates deterministic gameplay parameters from a random seed.
  """
  def generate_session(streak) do
    seed = :rand.uniform(1_000_000_000)

    {r_timer, seed_state} = next_lcg(seed)
    {r_width, seed_state} = next_lcg(seed_state)
    {r_speed, _seed_state} = next_lcg(seed_state)

    rand_timer = r_timer * 3.0 + 5.0
    rand_width = r_width * 20.0 + 30.0
    rand_speed = r_speed * 200.0 + 100.0

    timer = rand_timer + min(streak / 50.0, 5.0)
    timer = Float.round(timer, 2)

    bucket_width = rand_width + min(div(streak, 10), 30)
    bucket_speed = rand_speed + min(streak, 200)

    %{
      "seed" => seed,
      "timer" => timer,
      "bucket_width" => bucket_width,
      "bucket_speed" => bucket_speed
    }
  end

  @doc """
  Runs an identical deterministic simulation of item spawns.
  """
  def simulate_rain(seed, timer, streak) do
    spawn_interval = 0.05
    total_spawns = trunc(timer / spawn_interval)
    rules = Constants.bonustime_game_rules()["coin_rain"]
    chances = rules["chances"]

    {items, _final_seed} =
      Enum.reduce(0..(total_spawns - 1), {[], seed}, fn index, {acc, cur_seed} ->
        {r_type, cur_seed} = next_lcg(cur_seed)
        {r_x, cur_seed} = next_lcg(cur_seed)

        # Generate X coordinate using the same seed state
        r_x_val = r_x * 1120.0

        # Base chance to spawn reward item is 3.5%
        # Scales with streak: +0.5% per 45 streak, capped at 5% total
        scaling = rules["streak_scaling"]
        bonus_rolls = min(scaling["max_bonus"], div(streak, scaling["interval"]))
        reward_chance = 0.035 + bonus_rolls * 0.005

        {tier, next_seed_2} =
          if r_type < reward_chance do
            {r_tier, temp_seed} = next_lcg(cur_seed)
            t = select_tier(r_tier, chances)
            {t, temp_seed}
          else
            {0, cur_seed}
          end

        speed_mult = if tier == 0, do: 1, else: tier + 1
        speed = 120.0 * speed_mult

        item = %{
          id: index,
          x: r_x_val,
          speed: speed,
          tier: tier,
          spawn_time: index * 0.05
        }

        {[{index, item} | acc], next_seed_2}
      end)

    Map.new(items)
  end

  @doc """
  Validates a client-submitted recorded bucket path against simulated spawn results.
  """
  def evaluate_results(path, seed, timer, streak, bucket_speed, bucket_width)
      when is_list(path) do
    # 1. Parse and sort the recorded path
    parsed_path = parse_path(path)

    # 2. Validate path physics: check for teleportation hacks
    if not validate_path_physics(parsed_path, bucket_speed) do
      # Return default min rewards on hack detection
      {1, 0}
    else
      # 3. Simulate rain spawns
      rain_map = simulate_rain(seed, timer, streak)

      # 4. Check collision for each item against interpolated bucket path
      caught_items =
        Enum.reduce(rain_map, [], fn {_id, item}, acc ->
          # catch_time relative to PLAYING start, in ms
          catch_time_ms = (item.spawn_time + 620.0 / item.speed) * 1000.0
          bucket_x = interpolate_bucket_x(parsed_path, catch_time_ms)

          # Item within bucket radius (with a safe 5px margin of error)
          if abs(item.x - bucket_x) <= bucket_width / 2.0 + 5.0 do
            [item | acc]
          else
            acc
          end
        end)

      coins_caught = Enum.count(caught_items, &(&1.tier == 0))
      reward_tiers_caught = caught_items |> Enum.map(& &1.tier) |> Enum.filter(&(&1 >= 1))

      highest_tier =
        if Enum.empty?(reward_tiers_caught) do
          1
        else
          Enum.max(reward_tiers_caught)
        end

      {highest_tier, coins_caught}
    end
  end

  # ============================================================================
  # Math & Path Helpers
  # ============================================================================

  defp parse_path(path) do
    path
    |> Enum.map(fn
      [t, x] -> {to_float(t), to_float(x)}
      {t, x} -> {to_float(t), to_float(x)}
      _ -> nil
    end)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(fn {t, _x} -> t end)
  end

  defp to_float(val) when is_integer(val), do: val * 1.0
  defp to_float(val) when is_float(val), do: val
  defp to_float(_), do: 0.0

  defp validate_path_physics(parsed_path, bucket_speed) do
    if length(parsed_path) < 2 do
      true
    else
      # Ensure bucket doesn't exceed maximum speed limit between points
      Enum.chunk_every(parsed_path, 2, 1, :discard)
      |> Enum.all?(fn [{t_a, x_a}, {t_b, x_b}] ->
        dt = (t_b - t_a) / 1000.0
        dx = abs(x_b - x_a)

        # 1.15 speed scale fudge factor + 15px flat slack for timing jitter
        max_dist = bucket_speed * 1.15 * dt + 15.0
        dx <= max_dist
      end)
    end
  end

  defp interpolate_bucket_x(parsed_path, target_t) do
    case parsed_path do
      [] ->
        560.0

      [{_t, x}] ->
        x

      _ ->
        case Enum.find_index(parsed_path, fn {t, _x} -> t > target_t end) do
          nil ->
            {_t, x} = List.last(parsed_path)
            x

          0 ->
            {_t, x} = hd(parsed_path)
            x

          idx ->
            {t_a, x_a} = Enum.at(parsed_path, idx - 1)
            {t_b, x_b} = Enum.at(parsed_path, idx)

            dt = t_b - t_a

            if dt > 0.001 do
              fraction = (target_t - t_a) / dt
              x_a + fraction * (x_b - x_a)
            else
              x_a
            end
        end
    end
  end

  defp next_lcg(seed) do
    next_seed = rem(seed * 9301 + 49297, 233_280)
    {next_seed / 233_280.0, next_seed}
  end

  defp select_tier(r, chances) do
    {_, index} =
      Enum.reduce_while(chances, {0.0, 0}, fn chance, {acc, idx} ->
        new_acc = acc + chance

        if r <= new_acc do
          {:halt, {new_acc, idx}}
        else
          {:cont, {new_acc, idx + 1}}
        end
      end)

    index + 1
  end
end
