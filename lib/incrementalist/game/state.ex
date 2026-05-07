defmodule Incrementalist.Game.State do
  @moduledoc """
  Versioned JSON save-state shape used while rules are still moving.

  The persisted JSON can contain internal fields that are not part of the wire
  contract. Snapshots and save summaries are separate projections that include
  only data the player is allowed to render.
  """

  alias Incrementalist.Game.Time

  @current_version 1

  def new(now \\ Time.now()) do
    timestamp = Time.iso8601(now)

    %{
      "version" => @current_version,
      "area" => "sage",
      "level" => 1,
      "exp" => 0,
      "required_exp" => 20,
      "coins" => 0,
      "shards" => 0,
      "cores" => 0,
      "progress_bar" => %{
        "sisu" => 1,
        "reward_multiplier" => 1.0,
        "rewards_claimed" => 0
      },
      "idle_mode" => false,
      "first_played_at" => timestamp,
      "last_claimed_at" => timestamp,
      "can_claim_at" => nil,
      "saved_at" => timestamp,
      "features" => %{
        "idle_mode_purchased" => false,
        "world_map_unlocked" => false,
        "sisu_generator_purchased" => false,
        "bonus_time_purchased" => false
      },
      "sisu" => %{
        "current" => 1,
        "max" => 1,
        "level" => 1
      }
    }
  end

  def touch_saved_at(nil, now), do: new(now)

  def touch_saved_at(state, now) when is_map(state) do
    Map.put(state, "saved_at", Time.iso8601(now))
  end

  def visible_state(nil), do: visible_state(new())

  def visible_state(state) when is_map(state) do
    progress_bar = Map.get(state, "progress_bar", %{})

    # Save JSON can outlive code versions. Coercion here keeps the wire contract
    # stable even when older saves contain strings, floats, or missing fields.
    %{
      "area" => string(state, "area", "sage"),
      "level" => integer(state, "level", 1),
      "exp" => integer(state, "exp", 0),
      "required_exp" => integer(state, "required_exp", 20),
      "coins" => integer(state, "coins", 0),
      "shards" => integer(state, "shards", 0),
      "cores" => integer(state, "cores", 0),
      "idle_mode" => boolean(state, "idle_mode", false),
      "first_played_at" => string(state, "first_played_at", nil),
      "saved_at" => string(state, "saved_at", nil),
      "progress_bar" => %{
        "sisu" => integer(progress_bar, "sisu", 1),
        "reward_multiplier" => number(progress_bar, "reward_multiplier", 1.0),
        "rewards_claimed" => integer(progress_bar, "rewards_claimed", 0)
      }
    }
  end

  def summary(slot, active_slot_index) do
    state = slot.state
    progress_bar = if is_map(state), do: Map.get(state, "progress_bar", %{}), else: %{}

    # The save UI may cache this client-side, but these facts are regenerated
    # from the authoritative slot whenever the server sends a summary.
    %{
      "slot_index" => slot.slot_index,
      "file_index" => slot.slot_index,
      "is_current" => slot.slot_index == active_slot_index,
      "has_data" => is_map(state),
      "level" => integer(state || %{}, "level", 1),
      "rewards_claimed" => integer(progress_bar, "rewards_claimed", 0),
      "saved_at" => Time.iso8601(slot.last_saved_at)
    }
  end

  defp integer(map, key, default) do
    case Map.get(map, key) do
      value when is_integer(value) ->
        value

      value when is_float(value) ->
        trunc(value)

      value when is_binary(value) ->
        case Integer.parse(value) do
          {integer, _rest} -> integer
          :error -> default
        end

      _ ->
        default
    end
  end

  defp number(map, key, default) do
    case Map.get(map, key) do
      value when is_integer(value) ->
        value * 1.0

      value when is_float(value) ->
        value

      value when is_binary(value) ->
        case Float.parse(value) do
          {number, _rest} -> number
          :error -> default
        end

      _ ->
        default
    end
  end

  defp string(map, key, default) do
    case Map.get(map, key) do
      value when is_binary(value) -> value
      _ -> default
    end
  end

  defp boolean(map, key, default) do
    case Map.get(map, key) do
      value when is_boolean(value) -> value
      _ -> default
    end
  end
end
