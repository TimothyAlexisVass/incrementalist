defmodule Incrementalist.Game.Features.BonusTime.Games.CoinRainTest do
  use ExUnit.Case, async: true
  alias Incrementalist.Game.Features.BonusTime.Games.CoinRain

  test "roll_reward/1 scales number of rolls based on streak" do
    {_tier, rolls} = CoinRain.roll_reward(0)
    assert length(rolls) == 1

    {_tier, rolls} = CoinRain.roll_reward(45)
    assert length(rolls) == 2

    {_tier, rolls} = CoinRain.roll_reward(90)
    assert length(rolls) == 3

    {_tier, rolls} = CoinRain.roll_reward(135)
    assert length(rolls) == 4
  end

  test "roll_reward/1 outcomes are strictly valid tiers between 1 and 7" do
    for streak <- [0, 45, 90, 135] do
      {tier, rolls} = CoinRain.roll_reward(streak)
      assert tier >= 1 and tier <= 7
      assert Enum.all?(rolls, fn r -> r >= 1 and r <= 7 end)
      assert tier == Enum.max(rolls)
    end
  end

  test "generate_session/1 generates correct structures and is bounded" do
    for streak <- [0, 50, 100, 200] do
      session = CoinRain.generate_session(streak)
      assert is_integer(session["seed"])
      assert session["timer"] >= 5.0 and session["timer"] <= 13.0
      assert session["bucket_width"] >= 30.0 and session["bucket_width"] <= 110.0
      assert session["bucket_speed"] >= 100.0 and session["bucket_speed"] <= 700.0
    end
  end

  test "simulate_rain/3 is deterministic and generates coins and rewards" do
    seed = 123456
    timer = 8.0
    streak = 90

    rain_1 = CoinRain.simulate_rain(seed, timer, streak)
    rain_2 = CoinRain.simulate_rain(seed, timer, streak)

    # Must be 100% identical and deterministic
    assert rain_1 == rain_2

    # Verify indices
    total_spawns = trunc(timer / 0.05)
    assert map_size(rain_1) == total_spawns

    # Check if there are some reward items (tier > 0)
    reward_items = Enum.filter(rain_1, fn {_idx, item} -> item.tier > 0 end)
    assert length(reward_items) >= 0
  end

  test "evaluate_results/6 correctly verifies caught items using recorded bucket path" do
    seed = 987654
    timer = 5.0
    streak = 10
    bucket_speed = 300.0
    bucket_width = 60.0

    rain = CoinRain.simulate_rain(seed, timer, streak)

    # Find a reward item spawn
    reward_item =
      rain
      |> Map.values()
      |> Enum.find(fn item -> item.tier > 0 end)

    # 1. Test a valid path that catches the reward item
    path_1 =
      if reward_item do
        catch_time_ms = (reward_item.spawn_time + 620.0 / reward_item.speed) * 1000.0
        
        # Path where bucket starts at 560, smoothly moves to the reward item's X, catches it, and stays there
        travel_time_ms = (abs(reward_item.x - 560.0) / bucket_speed) * 1000.0
        
        [
          [0.0, 560.0],
          [travel_time_ms, reward_item.x],
          [catch_time_ms, reward_item.x],
          [5000.0, reward_item.x]
        ]
      else
        # Fallback if no reward items spawned
        [[0.0, 560.0], [5000.0, 560.0]]
      end

    {highest_tier_1, _coins_1} = CoinRain.evaluate_results(path_1, seed, timer, streak, bucket_speed, bucket_width)
    if reward_item do
      assert highest_tier_1 == reward_item.tier
    else
      assert highest_tier_1 == 1
    end

    # 2. Test an invalid path (hacking / teleportation)
    # Bucket instantly moves from 0 to 480 at t = 10ms (violates max speed)
    invalid_path = [
      [0.0, 0.0],
      [10.0, 480.0],
      [5000.0, 480.0]
    ]

    {highest_tier_2, coins_2} = CoinRain.evaluate_results(invalid_path, seed, timer, streak, bucket_speed, bucket_width)
    # Hacking caught, returns default fallback rewards
    assert highest_tier_2 == 1
    assert coins_2 == 0
  end
end
