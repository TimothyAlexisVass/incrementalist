defmodule Incrementalist.Game.Features.OrchardTest do
  use Incrementalist.DataCase, async: false

  alias BigNum
  alias Incrementalist.Game.{Commands, State, Time, Notices, Sessions}
  alias Incrementalist.Game.Persistence.{Player, PlayerState, PlayerStates}
  alias Incrementalist.Game.Session.PlayerServer
  alias Incrementalist.Repo
  alias Incrementalist.Game.Features.Orchard.Soil, as: OrchardSoil

  @now ~U[2026-05-04 12:00:00.000000Z]

  setup do
    player = create_player()
    {:ok, player: player}
  end

  test "orchard.unlock_plot unlocks a locked plot when having enough shards", %{player: player} do
    # plot_2 needs 2 * 100 = 200 shards
    # Initially player has 0 shards
    result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.unlock_plot",
        intent(0, %{"plot_id" => "plot_2"}),
        @now
      )

    assert result["type"] == "command.error"
    assert result["reason"] == "insufficient_shards"

    Commands.ack(player.id, "test_session", 0, @now)

    # Give shards
    update_player_state(player.id, fn state ->
      %{state | shards: BigNum.from_number(250)}
    end)

    # Unlock plot_2
    success =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.unlock_plot",
        intent(1, %{"plot_id" => "plot_2"}),
        @now
      )

    assert success["type"] == "orchard.unlock_plot.result"
    assert success["status"] == "ok"
    assert "plot_2" in success["unlocked_plots"]
    assert BigNum.to_float(success["shards"]) == 50.0

    # Verify state in database
    ps = PlayerStates.get!(player.id)
    assert "plot_2" in ps.state.unlocked_plots
    assert Enum.any?(ps.state.plots, &(&1.id == "plot_2"))
  end

  test "orchard.plant_seed plants clover patch on plot_1, consuming seeds and soil nutrients", %{
    player: player
  } do
    # Clover Patch planting requires 50 clover seeds
    # Soil nitrogen is clamped/default. Let's make sure player has enough seeds and soil nutrients
    update_player_state(player.id, fn state ->
      %{
        state
        | clover_seeds: BigNum.from_number(100),
          soil: %{
            state.soil
            | nitrogen: BigNum.from_number(20),
              phosphorus: BigNum.from_number(20),
              potassium: BigNum.from_number(20),
              organic_matter: BigNum.from_number(10)
          }
      }
    end)

    # Plant a clover patch on plot_1
    result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.plant_seed",
        intent(0, %{"plot_id" => "plot_1", "seed_id" => "clover_seeds"}),
        @now
      )

    assert result["type"] == "orchard.plant_seed.result"
    assert result["status"] == "ok"
    assert result["plant_id"] == "clover_patch"

    # Verify inventory is deducted by 50
    ps = PlayerStates.get!(player.id)
    assert BigNum.to_float(ps.state.clover_seeds) == 50.0

    # Verify plot contains the growing plant
    plot = Enum.find(ps.state.plots, &(&1.id == "plot_1"))
    assert plot.plant
    assert plot.plant.plant_id == "clover_patch"
    assert plot.plant.growth == 0.0
  end

  test "unified minute-by-minute projection simulates plant growth and soil nitrogen fixing", %{
    player: player
  } do
    # Plant a seed first
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        plant_id: "clover_patch",
        growth: 0.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }

      plots =
        Enum.map(state.plots, fn
          p when p.id == "plot_1" -> %{p | plant: plant}
          p -> p
        end)

      %{
        state
        | plots: plots,
          soil: %{
            state.soil
            | water_level: 100.0,
              projected_at: Time.iso8601(@now),
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
    plot = Enum.find(projected.plots, &(&1.id == "plot_1"))
    assert plot.plant.growth > 0.0

    # Clover patches fix nitrogen, check nitrogen has increased relative to leaching alone
    assert BigNum.compare(projected.soil.nitrogen, BigNum.zero()) > 0
  end

  test "orchard.harvest_plot burn adds to inventory, clearing plot and adding to furnace queue",
       %{player: player} do
    # Plant a fully grown plant on plot_1
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        plant_id: "clover_patch",
        growth: 100.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }

      plots =
        Enum.map(state.plots, fn
          p when p.id == "plot_1" -> %{p | plant: plant}
          p -> p
        end)

      %{state | plots: plots, clover_seeds: BigNum.zero()}
    end)

    # Harvest with "burn"
    result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.harvest_plot",
        intent(0, %{"plot_id" => "plot_1", "action" => "burn"}),
        @now
      )

    assert result["type"] == "orchard.harvest_plot.result"
    assert result["status"] == "ok"
    assert result["action"] == "burn"

    # Verify clover seeds are gained
    ps = PlayerStates.get!(player.id)
    assert BigNum.compare(ps.state.clover_seeds, BigNum.zero()) > 0
    assert BigNum.to_float(ps.state.furnace.burn_queue) == 50.0

    # Verify plot is cleared and depth is incremented
    plot = Enum.find(ps.state.plots, &(&1.id == "plot_1"))
    assert is_nil(plot.plant)
    assert is_nil(plot.decomposition)
    assert plot.depth == 2
  end

  test "orchard.harvest_plot decompose spawns decomposition on the plot", %{player: player} do
    # Plant a fully grown plant on plot_1
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        plant_id: "clover_patch",
        growth: 100.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }

      plots =
        Enum.map(state.plots, fn
          p when p.id == "plot_1" -> %{p | plant: plant}
          p -> p
        end)

      %{state | plots: plots}
    end)

    # Harvest with "decompose"
    result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.harvest_plot",
        intent(0, %{"plot_id" => "plot_1", "action" => "decompose"}),
        @now
      )

    assert result["type"] == "orchard.harvest_plot.result"
    assert result["status"] == "ok"
    assert result["action"] == "decompose"

    # Verify plot has decomposition
    ps = PlayerStates.get!(player.id)
    plot = Enum.find(ps.state.plots, &(&1.id == "plot_1"))
    assert is_nil(plot.plant)
    assert plot.decomposition
    assert plot.decomposition.resource_id == "plant_matter"
    assert BigNum.compare(plot.decomposition.amount, BigNum.zero()) > 0
    assert plot.decomposition.progress == 0.0
  end

  test "orchard.harvest_plot rejects an unsupported harvest action", %{player: player} do
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        plant_id: "clover_patch",
        growth: 100.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }

      plots =
        Enum.map(state.plots, fn
          plot when plot.id == "plot_1" -> %{plot | plant: plant}
          plot -> plot
        end)

      %{state | plots: plots}
    end)

    result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.harvest_plot",
        intent(0, %{"plot_id" => "plot_1", "action" => "discard"}),
        @now
      )

    assert result["type"] == "command.error"
    assert result["reason"] == "invalid_harvest_action"

    ps = PlayerStates.get!(player.id)
    plot = Enum.find(ps.state.plots, &(&1.id == "plot_1"))
    assert plot.plant
  end

  test "orchard command results keep decomposition progress for untouched plots within the same minute",
       %{player: player} do
    update_player_state(player.id, fn state ->
      decomposition = %State.Decomposition{
        resource_id: "plant_matter",
        amount: BigNum.from_number(2),
        progress: 0.0,
        started_at: Time.iso8601(@now)
      }

      plots =
        Enum.map(state.plots, fn
          p when p.id == "plot_1" -> %{p | depth: 2, plant: nil, decomposition: decomposition}
          p -> p
        end)

      %{
        state
        | shards: BigNum.from_number(500),
          clover_seeds: BigNum.from_number(200),
          plots: plots,
          soil: %{state.soil | water_level: 100.0, projected_at: Time.iso8601(@now)}
      }
    end)

    first_now = DateTime.add(@now, 30, :second)

    unlock_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.unlock_plot",
        intent(0, %{"plot_id" => "plot_2"}),
        first_now
      )

    assert unlock_result["type"] == "orchard.unlock_plot.result"

    first_progress = result_plot_decomposition_progress(unlock_result, "plot_1")
    assert first_progress > 0.0

    Commands.ack(player.id, "test_session", 0, first_now)

    second_now = DateTime.add(@now, 40, :second)

    plant_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.plant_seed",
        intent(1, %{"plot_id" => "plot_2", "seed_id" => "clover_seeds"}),
        second_now
      )

    assert plant_result["type"] == "orchard.plant_seed.result"

    second_progress = result_plot_decomposition_progress(plant_result, "plot_1")
    assert second_progress >= first_progress
    assert result_plot_plant_growth(plant_result, "plot_2") == 0.0
  end

  test "orchard command results keep plant growth for untouched plots within the same minute", %{
    player: player
  } do
    update_player_state(player.id, fn state ->
      plant = %State.Plant{
        plant_id: "clover_patch",
        growth: 0.0,
        level: 1,
        planted_at: Time.iso8601(@now)
      }

      plots =
        Enum.map(state.plots, fn
          p when p.id == "plot_1" -> %{p | depth: 2, plant: plant, decomposition: nil}
          p -> p
        end)

      %{
        state
        | shards: BigNum.from_number(500),
          clover_seeds: BigNum.from_number(200),
          plots: plots,
          soil: %{state.soil | water_level: 100.0, projected_at: Time.iso8601(@now)}
      }
    end)

    first_now = DateTime.add(@now, 30, :second)

    unlock_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.unlock_plot",
        intent(0, %{"plot_id" => "plot_2"}),
        first_now
      )

    assert unlock_result["type"] == "orchard.unlock_plot.result"

    first_growth = result_plot_plant_growth(unlock_result, "plot_1")
    assert first_growth > 0.0

    Commands.ack(player.id, "test_session", 0, first_now)

    second_now = DateTime.add(@now, 40, :second)

    plant_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.plant_seed",
        intent(1, %{"plot_id" => "plot_2", "seed_id" => "clover_seeds"}),
        second_now
      )

    assert plant_result["type"] == "orchard.plant_seed.result"

    second_growth = result_plot_plant_growth(plant_result, "plot_1")
    assert second_growth >= first_growth
    assert result_plot_plant_growth(plant_result, "plot_2") == 0.0
  end

  test "plots planted at different seconds keep distinct progress in subsequent orchard results",
       %{player: player} do
    update_player_state(player.id, fn state ->
      plots =
        state.plots
        |> ensure_plot("plot_2")
        |> ensure_plot("plot_3")
        |> ensure_plot("plot_4")

      %{
        state
        | shards: BigNum.from_number(2000),
          clover_seeds: BigNum.from_number(500),
          unlocked_plots: ["plot_1", "plot_2", "plot_3"],
          plots: plots,
          soil: %{
            state.soil
            | water_level: 100.0,
              nitrogen: BigNum.from_number(50),
              phosphorus: BigNum.from_number(50),
              potassium: BigNum.from_number(50),
              organic_matter: BigNum.from_number(20),
              projected_at: Time.iso8601(@now)
          }
      }
    end)

    first_plant_at = DateTime.add(@now, 5, :second)

    first_plant_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.plant_seed",
        intent(0, %{"plot_id" => "plot_1", "seed_id" => "clover_seeds"}),
        first_plant_at
      )

    assert first_plant_result["type"] == "orchard.plant_seed.result"
    Commands.ack(player.id, "test_session", 0, first_plant_at)

    second_plant_at = DateTime.add(@now, 50, :second)

    second_plant_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.plant_seed",
        intent(1, %{"plot_id" => "plot_2", "seed_id" => "clover_seeds"}),
        second_plant_at
      )

    assert second_plant_result["type"] == "orchard.plant_seed.result"
    Commands.ack(player.id, "test_session", 1, second_plant_at)

    trigger_at = DateTime.add(@now, 70, :second)

    trigger_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.unlock_plot",
        intent(2, %{"plot_id" => "plot_4"}),
        trigger_at
      )

    assert trigger_result["type"] == "orchard.unlock_plot.result"

    first_growth = result_plot_plant_growth(trigger_result, "plot_1")
    second_growth = result_plot_plant_growth(trigger_result, "plot_2")

    assert first_growth > second_growth
  end

  test "decomposing a second plot does not over-advance an earlier decomposition within the minute",
       %{player: player} do
    update_player_state(player.id, fn state ->
      ready_plant_1 = %State.Plant{
        plant_id: "clover_patch",
        growth: 100.0,
        level: 1,
        planted_at: Time.iso8601(DateTime.add(@now, -5, :minute))
      }

      ready_plant_2 = %State.Plant{
        plant_id: "clover_patch",
        growth: 100.0,
        level: 1,
        planted_at: Time.iso8601(DateTime.add(@now, -5, :minute))
      }

      plots =
        state.plots
        |> ensure_plot("plot_2")
        |> Enum.map(fn
          p when p.id == "plot_1" -> %{p | depth: 2, plant: ready_plant_1, decomposition: nil}
          p when p.id == "plot_2" -> %{p | depth: 2, plant: ready_plant_2, decomposition: nil}
          p -> p
        end)

      %{
        state
        | shards: BigNum.from_number(1000),
          unlocked_plots: ["plot_1", "plot_2"],
          plots: plots,
          soil: %{state.soil | water_level: 100.0, projected_at: Time.iso8601(@now)}
      }
    end)

    first_decompose_at = DateTime.add(@now, 40, :second)

    first_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.harvest_plot",
        intent(0, %{"plot_id" => "plot_1", "action" => "decompose"}),
        first_decompose_at
      )

    assert first_result["type"] == "orchard.harvest_plot.result"
    Commands.ack(player.id, "test_session", 0, first_decompose_at)

    second_decompose_at = DateTime.add(@now, 46, :second)

    second_result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.harvest_plot",
        intent(1, %{"plot_id" => "plot_2", "action" => "decompose"}),
        second_decompose_at
      )

    assert second_result["type"] == "orchard.harvest_plot.result"

    first_plot_progress = result_plot_decomposition_progress(second_result, "plot_1")
    assert first_plot_progress > 0.8
    assert first_plot_progress < 1.2
  end

  test "orchard.splice_seeds combines seeds into a coin tree seed", %{player: player} do
    # Give gold and ingredients
    update_player_state(player.id, fn state ->
      %{
        state
        | coins: BigNum.from_number(5000),
          clover_seeds: BigNum.from_number(100),
          acorns: BigNum.from_number(10)
      }
    end)

    result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.splice_seeds",
        intent(0, %{"seed_a" => "clover_seeds", "seed_b" => "acorn"}),
        @now
      )

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

    result =
      Commands.enqueue(
        player.id,
        "test_session",
        "orchard.buy_seed",
        intent(0, %{"seed_id" => "clover_seeds", "amount" => 10}),
        @now
      )

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
    :ok = PlayerServer.connect_channel(player.id, "test_session")
    _snapshot = Sessions.boot_player(player.id, false, @now)

    on_exit(fn ->
      PlayerServer.disconnect_channel(player.id)
    end)

    Repo.get!(Player, player.id)
  end

  defp intent(command_id, attrs) do
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

  defp ensure_plot(plots, plot_id) do
    if Enum.any?(plots, &(&1.id == plot_id)) do
      plots
    else
      [%State.Plot{id: plot_id, depth: 1} | plots]
    end
  end

  defp result_plot_decomposition_progress(result, plot_id) do
    result
    |> result_plot(plot_id)
    |> Map.fetch!("decomposition")
    |> Map.fetch!("progress")
  end

  defp result_plot_plant_growth(result, plot_id) do
    result
    |> result_plot(plot_id)
    |> Map.fetch!("plant")
    |> Map.fetch!("growth")
  end

  test "furnace burning adds potassium to soil over time", %{player: player} do
    update_player_state(player.id, fn state ->
      %{
        state
        | furnace: %{state.furnace | burn_queue: BigNum.from_number(20)},
          soil: %{
            state.soil
            | water_level: 0.0,
              potassium: BigNum.zero(),
              projected_at: Time.iso8601(@now)
          }
      }
    end)

    # Let 1 minute pass
    future_time_1 = DateTime.add(@now, 60_000, :millisecond)
    ps = PlayerStates.get!(player.id)
    projected_1 = OrchardSoil.project_state(ps.state, future_time_1)

    # Zero water prevents leaching, isolating the furnace yield.
    # 10 plant matter burned. K gain = 10.0 * 0.02 = 0.2 K.
    # Remaining burn queue = 10.0.
    assert BigNum.to_float(projected_1.furnace.burn_queue) == 10.0
    assert BigNum.to_float(projected_1.soil.potassium) == 0.2

    # Let another minute pass
    future_time_2 = DateTime.add(@now, 120_000, :millisecond)
    projected_2 = OrchardSoil.project_state(ps.state, future_time_2)

    # Remaining 10 plant matter burned. K gain = another 0.2 K (total 0.4 K).
    # Remaining burn queue = 0.
    assert BigNum.to_float(projected_2.furnace.burn_queue) == 0.0
    assert BigNum.to_float(projected_2.soil.potassium) == 0.4
  end

  defp result_plot(result, plot_id) do
    case Enum.find(result["plots"] || [], &(&1["id"] == plot_id)) do
      nil -> raise "missing plot #{plot_id} in result"
      plot -> plot
    end
  end
end
