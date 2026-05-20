defmodule Incrementalist.Game.Persistence.PlayerStates do
  @moduledoc """
  Persistence helpers for the single-state-per-player model.

  Each player always has exactly one row. An empty row (state == nil) is
  initialized on first access.
  """

  import Ecto.Query

  alias Incrementalist.Game.{Snapshots, State, Time, Notices}
  alias Incrementalist.Game.Features.Progress.Sisu
  alias Incrementalist.Game.Persistence.{Player, PlayerState}
  alias Incrementalist.Repo

  def ensure_state(player_id, now \\ Time.now()) do
    # The unique index on player_id makes this safe on every boot.
    Repo.insert_all(
      PlayerState,
      [
        %{
          player_id: player_id,
          inserted_at: now,
          updated_at: now
        }
      ],
      on_conflict: :nothing,
      conflict_target: [:player_id]
    )

    get(player_id) ||
      (
        ensure_state(player_id, now)
        get(player_id)
      )
  end

  def get(player_id) do
    Repo.one(
      from ps in PlayerState,
        where: ps.player_id == ^player_id
    )
  end

  def get!(player_id) do
    Repo.one!(
      from ps in PlayerState,
        where: ps.player_id == ^player_id
    )
  end

  def load_or_create(%Player{} = player, now \\ Time.now()) do
    ensure_state(player.id, now)
    ps = get!(player.id)
    initialize_if_empty(ps, now) |> PlayerState.inject_state_tokens()
  end

  def initialize_if_empty(player_state, now \\ Time.now())

  def initialize_if_empty(%PlayerState{state: nil} = ps, now) do
    next_state =
      now
      |> State.new()
      |> Sisu.project_state(now)

    ps
    |> PlayerState.changeset(%{
      state: next_state,
      has_bonustime_token: PlayerState.extract_state_tokens(next_state),
      bonustime_flips: PlayerState.extract_bonustime_flips(next_state),
      notices: Notices.new(next_state),
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def initialize_if_empty(%PlayerState{state: %State{} = state, notices: nil} = ps, now) do
    ps
    |> PlayerState.changeset(%{
      notices: Notices.new(state),
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def initialize_if_empty(
        %PlayerState{state: %State{} = state, notices: %Notices{} = notices} = ps,
        now
      ) do
    if notices.dismissed_leaf_ids == [] and notices.active_leaf_ids == [] and
         notices.active_parent_ids == [] do
      seeded = Notices.new(state)

      if seeded.active_leaf_ids != [] or seeded.active_parent_ids != [] do
        ps
        |> PlayerState.changeset(%{
          notices: seeded,
          last_saved_at: now
        })
        |> Repo.update!()
      else
        ps
      end
    else
      ps
    end
  end

  def initialize_if_empty(%PlayerState{} = ps, _now), do: ps

  def autosave(%PlayerState{} = ps, now \\ Time.now()) do
    projected_state =
      if ps.state do
        ps.state
        |> Sisu.project_state(now)
        |> State.touch_saved_at(now)
      else
        nil
      end

    ps
    |> PlayerState.changeset(%{
      state: projected_state,
      has_bonustime_token:
        if(projected_state,
          do: PlayerState.extract_state_tokens(projected_state),
          else: ps.has_bonustime_token
        ),
      bonustime_flips:
        if(projected_state,
          do: PlayerState.extract_bonustime_flips(projected_state),
          else: ps.bonustime_flips
        ),
      notices: ps.notices,
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def reset(%PlayerState{} = ps, now \\ Time.now()) do
    next_state =
      now
      |> State.new()
      |> Sisu.project_state(now)

    ps
    |> PlayerState.changeset(%{
      state: next_state,
      has_bonustime_token: PlayerState.extract_state_tokens(next_state),
      bonustime_flips: PlayerState.extract_bonustime_flips(next_state),
      notices: Notices.new(next_state),
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def snapshot_for_player(%Player{} = player, now \\ Time.now()) do
    ps = load_or_create(player, now)
    Snapshots.full(ps, now)
  end
end
