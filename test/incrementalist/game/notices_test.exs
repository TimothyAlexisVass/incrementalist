defmodule Incrementalist.Game.NoticesTest do
  use ExUnit.Case, async: true

  alias Incrementalist.Game.{Constants, Notices, State}

  test "showing a sage tip marks it seen and prevents sage guidance from reactivating after area switch" do
    sage_state = %{State.new() | level: 10, area: "sage"}
    sage_tip_leaf_id = "leaf.sage_tip.1.confirm_button"

    other_tip_leaf_ids =
      Constants.sage_tip_levels()
      |> Enum.reject(&(&1 == 1))
      |> Enum.map(&Notices.leaf_sage_tip_id/1)

    notices =
      Notices.new(sage_state)
      |> then(fn seeded ->
        %{
          seeded
          | dismissed_leaf_ids: Enum.uniq(seeded.dismissed_leaf_ids ++ other_tip_leaf_ids),
            active_leaf_ids: Enum.reject(seeded.active_leaf_ids, &(&1 in other_tip_leaf_ids))
        }
      end)

    assert sage_tip_leaf_id in notices.active_leaf_ids

    after_shown = Notices.apply_event(notices, :child_shown, sage_tip_leaf_id)

    assert sage_tip_leaf_id in after_shown.seen_leaf_ids
    refute sage_tip_leaf_id in after_shown.dismissed_leaf_ids
    assert sage_tip_leaf_id in after_shown.active_leaf_ids

    cloverfield_state = %{sage_state | area: "cloverfield"}

    after_area_switch =
      Notices.refresh_for_state_transition(after_shown, sage_state, cloverfield_state)

    refute "leaf.area.sage.go_button" in after_area_switch.active_leaf_ids
    refute Constants.notice_parent_area_dropdown() in after_area_switch.active_parent_ids
  end
end
