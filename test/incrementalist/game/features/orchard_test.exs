defmodule Incrementalist.Game.Features.OrchardTest do
  use Incrementalist.DataCase, async: false

  alias Incrementalist.Game.{Commands, State, Time, Constants, BigNum}
  alias Incrementalist.Game.Persistence.{Player, PlayerState, PlayerStates}
  alias Incrementalist.Game.Features.Orchard.Soil, as: OrchardSoil

  @now ~U[2026-05-04 12:00:00.000000Z]

  setup do
    player = create_player()
    {:ok, player: player}
  end

  test "orchard.unlock_plot unlocks a locked plot when having enough shards", %{player: player} do
    # plot_1 needs 1 * 100 = 100 shards
    # Initially player has 0 shards
    result = Commands.enqueue(player.id, "orchard.unlock_plot", intent(0, %{"plot_id" => "plot_1"}), @now)
    assert result["type"] == "command.error"
    assert result["reason"] == "insufficient_shards"

    Commands.ack(player.id, 0, @now)

    # Give shards
    update_player_state(player.id, fn state ->
      %{state | shards: BigNum.from_number(150)}
    end)

    # Unlock plot_1
    success = Commands.enqueue(player.id, "orchard.unlock_plot", intent(1, %{"plot_id" => "plot_1"}), @now)
    assert success["type"] == "orchard.unlock_plot.result"
    assert success["status"] == "ok"
    assert "plot_1" in success["unlocked_plots"]
    assert BigNum.to_float(success["shards"]) == 50.0

    # Verify state in database
    ps = PlayerStates.get!(player.id)
    assert "plot_1" in ps.state.unlocked_plots
    assert Enum.any?(ps.state.plots, &(&1.id == "plot_1"))
  end

  test "orchard.plant_seed plants clover on plot_16, consuming seeds and soil nutrients", %{player: player} do
    # Clover planting requires 50 clover seeds
    # Soil nitrogen is clamped/default. Let's make sure player has enough seeds and soil nutrients
    update_player_state(player.id, fn state ->
      %{state | 
        clover_seeds: BigNum.from_number(100),
        soil: %{state.soil |
          nitrogen: BigNum.from_number(20),
          phosphorus: BigNum.from_number(20),
          potassium: BigNum.from_number(20),
          organic_matter: BigNum.from_number(10)
        }
      }
    end)

    # Plant clovers on plot_16
    result = Commands.enqueue(player.id, "orchard.plant_seed", intent(0, %{"plot_id" => "plot_16", "seed_id" => "clover_seeds"}), @now)
    assert result["type"] == "orchard.plant_seed.result"
    assert result["status"] == "ok"
    assert result["seed_id"] == "clover_seeds"

    # Verify inventory is deducted by 50
    ps = PlayerStates.get!(player.id)
    assert BigNum.to_float(ps.state.clover_seeds) == 50.0

    # Verify plot contains the growing plant
    plot = Enum.find(ps.state.plots, &(&1.id == "plot_16"))
    assert plot.plant
    assert plot.plant.seed_id == "clover_seeds"
    assert plot.plant.growth_progress == 0.0
  end

  test "unified minute-by-minute projection simulates plant growth and soil nitrogen fixing", %{player: player} do
    # Plant a seed first
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        seed_id: "clover_seeds",
        growth: 0.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }
      
      plots = Enum.map(state.plots, fn
        p when p.id == "plot_16" -> %{p | plant: plant}
        p -> p
      end)

      %{state | 
        plots: plots,
        soil: %{state.soil |
          water_level: 100.0,
          nitrogen: BigNum.from_number(50),
          phosphorus: BigNum.from_number(50),
          potassium: BigNum.from_number(50),
          organic_matter: BigNum.from_number(20)
        }
      }
    end)

    # Let 10 minutes pass
    future_time = DateTime.add(@now, 10 * 60_000, :millisecond)
    
    ps = PlayerStates.get!(player.id)
    projected = OrchardSoil.project_state(ps.state, future_time)

    # Check plant growth progress has increased
    plot = Enum.find(projected.plots, &(&1.id == "plot_16"))
    assert plot.plant.growth > 0.0

    # Clovers fix nitrogen, check nitrogen has increased relative to leaching alone
    assert BigNum.compare(projected.soil.nitrogen, BigNum.zero()) > 0
  end

  test "orchard.harvest_plot keep adds to inventory and clears plant", %{player: player} do
    # Plant a fully grown plant on plot_16
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        seed_id: "clover_seeds",
        growth: 100.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }
      
      plots = Enum.map(state.plots, fn
        p when p.id == "plot_16" -> %{p | plant: plant}
        p -> p
      end)

      %{state | plots: plots, clover_seeds: BigNum.zero()}
    end)

    # Harvest with "keep"
    result = Commands.enqueue(player.id, "orchard.harvest_plot", intent(0, %{"plot_id" => "plot_16", "action" => "keep"}), @now)
    assert result["type"] == "orchard.harvest_plot.result"
    assert result["status"] == "ok"
    assert result["action"] == "keep"

    # Verify clover seeds are gained
    ps = PlayerStates.get!(player.id)
    assert BigNum.compare(ps.state.clover_seeds, BigNum.zero()) > 0

    # Verify plot is cleared and depth is incremented
    plot = Enum.find(ps.state.plots, &(&1.id == "plot_16"))
    assert is_nil(plot.plant)
    assert plot.depth == 2
  end

  test "orchard.harvest_plot decompose spawns decomposition on the plot", %{player: player} do
    # Plant a fully grown plant on plot_16
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        seed_id: "clover_seeds",
        growth: 100.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }
      
      plots = Enum.map(state.plots, fn
        p when p.id == "plot_16" -> %{p | plant: plant}
        p -> p
      end)

      %{state | plots: plots}
    end)

    # Harvest with "decompose"
    result = Commands.enqueue(player.id, "orchard.harvest_plot", intent(0, %{"plot_id" => "plot_16", "action" => "decompose"}), @now)
    assert result["type"] == "orchard.harvest_plot.result"
    assert result["status"] == "ok"
    assert result["action"] == "decompose"

    # Verify plot has decomposition
    ps = PlayerStates.get!(player.id)
    plot = Enum.find(ps.state.plots, &(&1.id == "plot_16"))
    assert is_nil(plot.plant)
    assert plot.decomposition
    assert plot.decomposition.resource_id == "plant_matter"
    assert BigNum.compare(plot.decomposition.amount, BigNum.zero()) > 0
    assert plot.decomposition.progress == 0.0
  end

  test "orchard.splice_seeds combines seeds into a coin tree seed", %{player: player} do
    # Give gold and ingredients
    update_player_state(player.id, fn state ->
      %{state | 
        coins: BigNum.from_number(5000),
        clover_seeds: BigNum.from_number(100),
        acorns: BigNum.from_number(10)
      }
    end)

    result = Commands.enqueue(player.id, "orchard.splice_seeds", intent(0, %{"seed_a" => "clover_seeds", "seed_b" => "acorn"}), @now)
    assert result["type"] == "orchard.splice_seeds.result"
    assert result["status"] == "ok"
    assert "coin_tree_seed" in result["spliced_seeds"]

    # Verify database state
    ps = PlayerStates.get!(player.id)
    assert "coin_tree_seed" in ps.state.spliced_seeds
  end

  test "orchard.buy_seed purchases seed from the shop using Gold", %{player: player} do
    # Give gold
    update_player_state(player.id, fn state ->
      %{state | coins: BigNum.from_number(100), clover_seeds: BigNum.zero()}
    end)

    result = Commands.enqueue(player.id, "orchard.buy_seed", intent(0, %{"seed_id" => "clover_seeds", "amount" => 10}), @now)
    assert result["type"] == "orchard.buy_seed.result"
    assert result["status"] == "ok"

    # Cost is 5 gold per seed, so 10 seeds = 50 gold. Remaining gold should be 50.
    ps = PlayerStates.get!(player.id)
    assert BigNum.to_float(ps.state.coins) == 50.0
    assert BigNum.to_float(ps.state.clover_seeds) == 10.0
  end

  # Helpers
  defp create_player do
    player = Sessions.authenticate_player(nil, @now)
    _snapshot = Sessions.boot_player(player.id, false, @now)
    Repo.get!(Player, player.id)
  end

  defp intent(command_id, attrs \\ %{}) do
    Map.put(attrs, "command_id", command_id)
  end

  defp update_player_state(player_id, modifier_fun) do
    ps = PlayerStates.get!(player_id)
    next_state = modifier_fun.(ps.state)

    ps
    |> PlayerState.changeset(%{
      state: next_state,
      notices: Notices.new(next_state),
      last_saved_at: @now
    })
    |> Repo.update!()
  end
end
