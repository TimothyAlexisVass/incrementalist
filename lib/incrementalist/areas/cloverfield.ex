defmodule Incrementalist.Game.Features.CloverHunt do
  @moduledoc """
  Authoritative Clover Hunt progression.

  The client may click locally at high frequency, but the server only advances
  authoritative progress in fixed threshold steps when commanded.
  """

  alias Incrementalist.Game.Constants
  alias Incrementalist.Game.Features.Areas
  alias Incrementalist.Game.State
  alias Incrementalist.Game.State.CloverHunt, as: CloverHuntState

  @doc """
  Advances Clover Hunt progress by exactly one threshold step.

  This command is only valid while the current area is Cloverfield.
  """
  def search(%State{} = state) do
    cond do
      state.area != "cloverfield" ->
        {:error, "cloverfield_only"}

      cloverfield_locked?(state) ->
        {:error, "area_locked"}

      true ->
        clover_hunt = state.clover_hunt || %CloverHuntState{}
        click_step = Constants.clover_hunt_click_step()
        next_click_count = (clover_hunt.click_count || 0) + click_step
        {updated_hunt, discoveries} = apply_discoveries(clover_hunt, next_click_count)
        {:ok, %{state | clover_hunt: updated_hunt}, discoveries}
    end
  end

  @doc """
  Confirms a discovered clover milestone from the client modal.

  Confirmation is server-authoritative and may trigger area flow changes.
  """
  def confirm_discovery(%State{} = state, discovery_id) when is_binary(discovery_id) do
    clover_hunt = state.clover_hunt || %CloverHuntState{}

    cond do
      discovery_id == "four_leaf_1" and (clover_hunt.four_leaf_found_count || 0) >= 1 ->
        {:ok, ensure_area(state, "sage")}

      discovery_id == "five_leaf_1" and (clover_hunt.five_leaf_found_count || 0) >= 1 ->
        {:ok, ensure_area(state, "sage")}

      discovery_id == "six_leaf_1" and clover_hunt.six_leaf_found == true ->
        updated_hunt = %{clover_hunt | six_leaf_confirmed: true}
        state = %{state | clover_hunt: updated_hunt}
        {:ok, ensure_area(state, "sage")}

      discovery_id == "four_leaf_2" and (clover_hunt.four_leaf_found_count || 0) >= 2 ->
        {:ok, state}

      discovery_id == "five_leaf_2" and (clover_hunt.five_leaf_found_count || 0) >= 2 ->
        {:ok, state}

      discovery_id == "five_leaf_3" and (clover_hunt.five_leaf_found_count || 0) >= 3 ->
        {:ok, state}

      true ->
        {:error, "invalid_discovery_confirmation"}
    end
  end

  def confirm_discovery(%State{} = _state, _discovery_id), do: {:error, "discovery_id_required"}

  defp apply_discoveries(%CloverHuntState{} = clover_hunt, next_click_count) do
    previous_click_count = clover_hunt.click_count || 0

    {four_leaf_found_count, discoveries} =
      clover_hunt.four_leaf_found_count
      |> maybe_cross_threshold(
        previous_click_count,
        next_click_count,
        Constants.clover_hunt_first_four_leaf_clicks(),
        1,
        "four_leaf_1"
      )
      |> maybe_cross_threshold(
        previous_click_count,
        next_click_count,
        Constants.clover_hunt_second_four_leaf_clicks(),
        2,
        "four_leaf_2"
      )

    {five_leaf_found_count, discoveries} =
      clover_hunt.five_leaf_found_count
      |> maybe_cross_threshold(
        previous_click_count,
        next_click_count,
        Constants.clover_hunt_first_five_leaf_clicks(),
        1,
        "five_leaf_1",
        discoveries
      )
      |> maybe_cross_threshold(
        previous_click_count,
        next_click_count,
        Constants.clover_hunt_second_five_leaf_clicks(),
        2,
        "five_leaf_2"
      )
      |> maybe_cross_threshold(
        previous_click_count,
        next_click_count,
        Constants.clover_hunt_third_five_leaf_clicks(),
        3,
        "five_leaf_3"
      )

    {six_leaf_found, discoveries} =
      maybe_cross_boolean_threshold(
        clover_hunt.six_leaf_found || false,
        previous_click_count,
        next_click_count,
        Constants.clover_hunt_first_six_leaf_clicks(),
        "six_leaf_1",
        discoveries
      )

    updated_hunt = %{
      clover_hunt
      | click_count: next_click_count,
        four_leaf_found_count: four_leaf_found_count,
        five_leaf_found_count: five_leaf_found_count,
        six_leaf_found: six_leaf_found
    }

    updated_hunt = %{updated_hunt | background_stage: compute_background_stage(updated_hunt)}

    {updated_hunt, Enum.reverse(discoveries)}
  end

  defp maybe_cross_threshold(
         {current_count, discoveries},
         previous_click_count,
         next_click_count,
         threshold_click_count,
         target_count,
         discovery_id
       ) do
    if current_count < target_count and previous_click_count < threshold_click_count and
         next_click_count >= threshold_click_count do
      {target_count, [discovery_id | discoveries]}
    else
      {current_count, discoveries}
    end
  end

  defp maybe_cross_threshold(
         current_count,
         previous_click_count,
         next_click_count,
         threshold_click_count,
         target_count,
         discovery_id
       ) do
    maybe_cross_threshold(
      {current_count || 0, []},
      previous_click_count,
      next_click_count,
      threshold_click_count,
      target_count,
      discovery_id
    )
  end

  defp maybe_cross_threshold(
         current_count,
         previous_click_count,
         next_click_count,
         threshold_click_count,
         target_count,
         discovery_id,
         discoveries
       ) do
    maybe_cross_threshold(
      {current_count || 0, discoveries},
      previous_click_count,
      next_click_count,
      threshold_click_count,
      target_count,
      discovery_id
    )
  end

  defp maybe_cross_boolean_threshold(
         current_flag,
         previous_click_count,
         next_click_count,
         threshold_click_count,
         discovery_id,
         discoveries
       ) do
    if !current_flag and previous_click_count < threshold_click_count and
         next_click_count >= threshold_click_count do
      {true, [discovery_id | discoveries]}
    else
      {current_flag, discoveries}
    end
  end

  defp compute_background_stage(%CloverHuntState{} = clover_hunt) do
    cond do
      (clover_hunt.five_leaf_found_count || 0) >= 3 -> 6
      (clover_hunt.five_leaf_found_count || 0) >= 2 -> 5
      (clover_hunt.five_leaf_found_count || 0) >= 1 -> 4
      (clover_hunt.four_leaf_found_count || 0) >= 2 -> 3
      (clover_hunt.four_leaf_found_count || 0) >= 1 -> 2
      true -> 1
    end
  end

  defp ensure_area(%State{} = state, area_key) do
    if state.area == "cloverfield" do
      %{state | area: area_key}
    else
      state
    end
  end

  defp cloverfield_locked?(%State{} = state) do
    case Enum.find(Areas.visible_area_defs(state), fn area -> area.key == "cloverfield" end) do
      nil -> true
      area -> area.is_locked == true
    end
  end
end
