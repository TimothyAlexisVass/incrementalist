defmodule Incrementalist.Game.Persistence.SaveSlots do
  @moduledoc """
  Persistence helpers for the four-slot save model.

  Each player always has rows for slots 0 through 3. Empty slots are represented
  by `state == nil`, which lets the save screen show all files without inventing
  durable gameplay state. Loading an empty slot initializes its JSON state on the
  server before a snapshot is returned.
  """

  import Ecto.Query

  alias Incrementalist.Game.{Constants, Snapshots, State, Time, Notices}
  alias Incrementalist.Game.Features.Progress.Sisu
  alias Incrementalist.Game.Persistence.{Player, SaveSlot}
  alias Incrementalist.Repo

  def ensure_four_slots(player_id, now \\ Time.now()) do
    # The unique index on {player_id, slot_index} makes this safe on every boot.
    # Missing rows are repaired, existing rows and their state are left untouched.
    rows =
      Enum.map(Constants.valid_slot_indexes(), fn slot_index ->
        %{
          player_id: player_id,
          slot_index: slot_index,
          inserted_at: now,
          updated_at: now
        }
      end)

    Repo.insert_all(SaveSlot, rows,
      on_conflict: :nothing,
      conflict_target: [:player_id, :slot_index]
    )

    get_slots(player_id)
    |> case do
      [] ->
        ensure_four_slots(player_id, now)

      slots ->
        slots
    end
  end

  def get_slots(player_id) do
    Repo.all(
      from slot in SaveSlot,
        where: slot.player_id == ^player_id,
        order_by: slot.slot_index
    )
  end

  def get_slot(player_id, slot_index) do
    Repo.one(
      from slot in SaveSlot,
        where: slot.player_id == ^player_id and slot.slot_index == ^slot_index
    )
  end

  def get_slot!(player_id, slot_index) do
    Repo.one!(
      from slot in SaveSlot,
        where: slot.player_id == ^player_id and slot.slot_index == ^slot_index
    )
  end

  def determine_active_slot(%Player{} = player, now \\ Time.now()) do
    slots = ensure_four_slots(player.id, now)

    # Boot must never trust a stale active pointer that targets an empty slot.
    # The visible behavior is: last valid slot, else first populated slot, else slot zero.
    selected_slot =
      Enum.find(slots, &(&1.slot_index == player.active_save_slot and &1.state != nil)) ||
        Enum.find(slots, &(&1.state != nil)) ||
        Enum.find(slots, &(&1.slot_index == 0))

    selected_slot = initialize_if_empty(selected_slot, now) |> SaveSlot.inject_state_tokens()

    if selected_slot.slot_index != player.active_save_slot do
      player
      |> Player.changeset(%{active_save_slot: selected_slot.slot_index, last_seen_at: now})
      |> Repo.update!()
    end

    selected_slot
  end

  def initialize_if_empty(save_slot, now \\ Time.now())

  def initialize_if_empty(%SaveSlot{state: nil} = save_slot, now) do
    next_state =
      now
      |> State.new()
      |> Sisu.project_state(now)

    save_slot
    |> SaveSlot.changeset(%{
      state: next_state,
      has_daily_token: SaveSlot.extract_state_tokens(next_state),
      notices: Notices.new(next_state),
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def initialize_if_empty(%SaveSlot{state: %State{} = state, notices: nil} = save_slot, now) do
    save_slot
    |> SaveSlot.changeset(%{
      notices: Notices.new(state),
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def initialize_if_empty(
        %SaveSlot{state: %State{} = state, notices: %Notices{} = notices} = save_slot,
        now
      ) do
    if notices.dismissed_leaf_ids == [] and notices.active_leaf_ids == [] and
         notices.active_parent_ids == [] do
      seeded = Notices.new(state)

      if seeded.active_leaf_ids != [] or seeded.active_parent_ids != [] do
        save_slot
        |> SaveSlot.changeset(%{
          notices: seeded,
          last_saved_at: now
        })
        |> Repo.update!()
      else
        save_slot
      end
    else
      save_slot
    end
  end

  def initialize_if_empty(%SaveSlot{} = save_slot, _now), do: save_slot

  def autosave(%SaveSlot{} = save_slot, now \\ Time.now()) do
    projected_state =
      if save_slot.state do
        save_slot.state
        |> Sisu.project_state(now)
        |> State.touch_saved_at(now)
      else
        nil
      end

    save_slot
    |> SaveSlot.changeset(%{
      state: projected_state,
      has_daily_token: if(projected_state, do: SaveSlot.extract_state_tokens(projected_state), else: save_slot.has_daily_token),
      notices: save_slot.notices,
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def reset(%SaveSlot{} = save_slot, now \\ Time.now()) do
    next_state =
      now
      |> State.new()
      |> Sisu.project_state(now)

    save_slot
    |> SaveSlot.changeset(%{
      state: next_state,
      has_daily_token: SaveSlot.extract_state_tokens(next_state),
      notices: Notices.new(next_state),
      last_saved_at: now
    })
    |> Repo.update!()
  end

  def switch_player_to_slot(%Player{} = player, slot_index, now \\ Time.now()) do
    # Validations should happen via commands/schemas, but we double-check here
    unless slot_index in Constants.valid_slot_indexes() do
      raise ArgumentError, "Invalid slot_index: #{slot_index}"
    end

    slots = get_slots(player.id)
    current_slot = Enum.find(slots, &(&1.slot_index == player.active_save_slot))
    target_slot_initial = Enum.find(slots, &(&1.slot_index == slot_index))

    if is_nil(current_slot) or is_nil(target_slot_initial) do
      raise Ecto.NoResultsError, queryable: SaveSlot
    end

    # Switching slots is also an autosave boundary for the outgoing active file.
    # The target can be empty, but the old slot must be durable first.
    _current_slot = autosave(current_slot, now)

    target_slot = initialize_if_empty(target_slot_initial, now) |> SaveSlot.inject_state_tokens()

    player
    |> Player.changeset(%{active_save_slot: slot_index, last_seen_at: now})
    |> Repo.update!()

    target_slot
  end

  def summaries(player_id, active_slot_index) do
    player_id
    |> get_slots()
    |> Enum.map(&State.summary(&1, active_slot_index))
  end

  def snapshot_for_player(%Player{} = player, now \\ Time.now()) do
    slot = determine_active_slot(player, now)
    Snapshots.full(slot, slot.slot_index, now)
  end
end
