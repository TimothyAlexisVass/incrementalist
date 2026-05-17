defmodule Incrementalist.Game.Notices do
  @moduledoc """
  Server-authoritative notice state and semantics.

  The server owns which leaf and parent notices are active. The client renders
  these IDs and emits semantic notice events (`child_shown`, `child_clicked`).
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Incrementalist.Game.{Constants, State}

  @notice_leaf_area_dropdown_button Constants.notice_leaf_area_dropdown_button()
  @notice_leaf_tab_shop_button Constants.notice_leaf_tab_shop_button()
  @notice_leaf_tab_quest_button Constants.notice_leaf_tab_quest_button()
  @notice_leaf_tab_achievements_button Constants.notice_leaf_tab_achievements_button()
  @notice_leaf_tab_menu_any_button Constants.notice_leaf_tab_menu_any_button()

  @primary_key false
  @derive Jason.Encoder
  embedded_schema do
    field :dismissed_leaf_ids, {:array, :string}, default: []
    field :seen_leaf_ids, {:array, :string}, default: []
    field :active_leaf_ids, {:array, :string}, default: []
    field :active_parent_ids, {:array, :string}, default: []
  end

  @type event_kind :: :child_shown | :child_clicked

  def changeset(schema \\ %__MODULE__{}, attrs) do
    schema
    |> cast(attrs, [:dismissed_leaf_ids, :seen_leaf_ids, :active_leaf_ids, :active_parent_ids])
  end

  def new(state \\ nil) do
    base = %__MODULE__{
      dismissed_leaf_ids: [],
      seen_leaf_ids: [],
      active_leaf_ids: [],
      active_parent_ids: []
    }

    if match?(%State{}, state) do
      active_leaf_ids = eligible_leaf_ids(state, base)

      %{
        base
        | active_leaf_ids: active_leaf_ids,
          active_parent_ids: parent_ids_for_leaves(active_leaf_ids)
      }
    else
      base
    end
  end

  def payload(%__MODULE__{} = notices) do
    %{
      "active_leaf_ids" => notices.active_leaf_ids,
      "active_parent_ids" => notices.active_parent_ids
    }
  end

  def valid_event_kind?(kind) when kind in [:child_shown, :child_clicked], do: true
  def valid_event_kind?(_kind), do: false

  def valid_leaf_id?(leaf_id) when is_binary(leaf_id) do
    case parse_leaf_id(leaf_id) do
      {:area, area_key} ->
        Enum.any?(Constants.area_defs(), &(&1.key == area_key))

      {:sage_tip, level} ->
        level in Constants.sage_tip_levels()

      {:shop_item, item_id} ->
        Enum.any?(Constants.shop_item_defs(), &(&1.id == item_id))

      {:quest, quest_id} ->
        Map.has_key?(Constants.quest_defs(), quest_id)

      {:achievement, achievement_id} ->
        Enum.any?(Constants.achievement_defs(), &(&1.id == achievement_id))

      {:feature_locked, feature_id} ->
        feature_id in ["idle_mode", "sisu_generator"]

      {:static, static_id} ->
        static_id in [
          Constants.notice_leaf_area_dropdown_button(),
          Constants.notice_leaf_tab_shop_button(),
          Constants.notice_leaf_tab_quest_button(),
          Constants.notice_leaf_tab_achievements_button(),
          Constants.notice_leaf_tab_menu_any_button()
        ]

      :unknown ->
        false
    end
  end

  def valid_leaf_id?(_leaf_id), do: false

  def refresh_for_state_transition(
        %__MODULE__{} = notices,
        %State{} = prev_state,
        %State{} = next_state
      ) do
    prev_eligible = MapSet.new(eligible_leaf_ids(prev_state, notices))
    next_eligible = MapSet.new(eligible_leaf_ids(next_state, notices))

    newly_eligible =
      next_eligible
      |> MapSet.difference(prev_eligible)
      |> MapSet.to_list()

    reactivatable_newly_eligible =
      Enum.reject(newly_eligible, &non_sage_area_leaf_id?/1)

    dismissed_leaf_ids =
      notices.dismissed_leaf_ids
      |> MapSet.new()
      |> MapSet.difference(MapSet.new(reactivatable_newly_eligible))
      |> MapSet.to_list()

    active_leaf_ids =
      notices.active_leaf_ids
      |> MapSet.new()
      |> MapSet.intersection(next_eligible)
      |> MapSet.union(
        newly_eligible
        |> Enum.reject(&(&1 in dismissed_leaf_ids))
        |> MapSet.new()
      )
      |> MapSet.to_list()

    active_parent_ids =
      notices.active_parent_ids
      |> MapSet.new()
      |> MapSet.union(parent_ids_for_leaves(newly_eligible) |> MapSet.new())
      |> MapSet.to_list()
      |> prune_parent_ids(active_leaf_ids)

    %{
      notices
      | dismissed_leaf_ids: dismissed_leaf_ids,
        active_leaf_ids: active_leaf_ids,
        active_parent_ids: active_parent_ids
    }
  end

  def apply_event(%__MODULE__{} = notices, :child_shown, leaf_id) do
    parent_ids = parent_chain_for_leaf(leaf_id)
    any_parent_active? = Enum.any?(parent_ids, &(&1 in notices.active_parent_ids))
    leaf_active? = leaf_id in notices.active_leaf_ids

    cond do
      not leaf_active? and not any_parent_active? ->
        notices

      true ->
        next_seen_leaf_ids = Enum.uniq([leaf_id | notices.seen_leaf_ids])

        next_active_leaf_ids =
          case parse_leaf_id(leaf_id) do
            {:sage_tip, _level} ->
              # Seeing an active Sage tip implicitly resolves the "go to Sage"
              # area leaf if it was only pointing the player back to that tip.
              Enum.reject(notices.active_leaf_ids, &(&1 == "leaf.area.sage.go_button"))

            {:achievement, _achievement_id} ->
              # Seeing an achievement card resolves the notification.
              Enum.reject(notices.active_leaf_ids, &(&1 == leaf_id))

            _ ->
              notices.active_leaf_ids
          end

        next_active_parent_ids =
          notices.active_parent_ids
          |> prune_parent_ids(next_active_leaf_ids)

        %{
          notices
          | seen_leaf_ids: next_seen_leaf_ids,
            active_leaf_ids: next_active_leaf_ids,
            active_parent_ids: next_active_parent_ids
        }
    end
  end

  def apply_event(%__MODULE__{} = notices, :child_clicked, leaf_id) do
    if leaf_id in notices.active_leaf_ids do
      next_active_leaf_ids = Enum.reject(notices.active_leaf_ids, &(&1 == leaf_id))

      next_active_parent_ids =
        notices.active_parent_ids
        |> prune_parent_ids(next_active_leaf_ids)

      %{
        notices
        | dismissed_leaf_ids: Enum.uniq([leaf_id | notices.dismissed_leaf_ids]),
          active_leaf_ids: next_active_leaf_ids,
          active_parent_ids: next_active_parent_ids
      }
    else
      notices
    end
  end

  def leaf_area_id(area_key), do: "leaf.area.#{area_key}.go_button"
  def leaf_sage_tip_id(level), do: "leaf.sage_tip.#{level}.confirm_button"
  def leaf_shop_item_id(item_id), do: "leaf.shop_item.#{item_id}.purchase_button"
  def leaf_quest_id(quest_id), do: "leaf.quest.#{quest_id}.claim_button"
  def leaf_achievement_id(achievement_id), do: "leaf.achievement.#{achievement_id}.unlocked"
  def leaf_feature_locked_id(feature_id), do: "leaf.feature.#{feature_id}.locked_text"

  defp eligible_leaf_ids(%State{} = state, %__MODULE__{} = notices) do
    dismissed = MapSet.new(notices.dismissed_leaf_ids)
    seen = MapSet.new(notices.seen_leaf_ids)
    current_area = state.area || "sage"

    area_leaves =
      Enum.flat_map(Constants.area_defs(), fn area ->
        is_unlocked = (state.level || 1) >= area.unlock_level

        if is_unlocked and area.key != current_area and area.key != "sage" do
          [leaf_area_id(area.key)]
        else
          []
        end
      end)

    sage_tip_leaves =
      Constants.sage_tip_levels()
      |> Enum.filter(&(&1 <= (state.level || 1)))
      |> Enum.map(&leaf_sage_tip_id/1)

    shop_item_leaves =
      Constants.shop_item_defs()
      |> Enum.flat_map(fn item ->
        purchased? = purchased_feature?(state, item.id)
        unlocked? = (state.level || 1) >= item.required_level

        if unlocked? and not purchased? do
          [leaf_shop_item_id(item.id)]
        else
          []
        end
      end)

    locked_feature_leaves =
      Constants.shop_item_defs()
      |> Enum.flat_map(fn item ->
        purchased? = purchased_feature?(state, item.id)
        unlocked? = (state.level || 1) >= item.required_level

        if item.id in ["idle_mode", "sisu_generator"] and unlocked? and not purchased? do
          [leaf_feature_locked_id(item.id)]
        else
          []
        end
      end)

    quest_leaves =
      state.quests
      |> Enum.flat_map(fn quest ->
        if quest.rank > quest.claimed_rank do
          [leaf_quest_id(quest.id)]
        else
          []
        end
      end)

    achievement_leaves =
      state.achievements
      |> Map.keys()
      |> Enum.map(&leaf_achievement_id/1)
      |> Enum.reject(&MapSet.member?(seen, &1))

    has_unconfirmed_sage_tip? =
      sage_tip_leaves
      |> Enum.any?(fn leaf_id ->
        not MapSet.member?(dismissed, leaf_id) and not MapSet.member?(seen, leaf_id)
      end)

    sage_area_guidance_leaf =
      if current_area != "sage" and has_unconfirmed_sage_tip? do
        ["leaf.area.sage.go_button"]
      else
        []
      end

    (area_leaves ++
       sage_tip_leaves ++
       shop_item_leaves ++
       locked_feature_leaves ++ quest_leaves ++ achievement_leaves ++ sage_area_guidance_leaf)
    |> Enum.uniq()
  end

  defp parent_ids_for_leaves(leaf_ids) do
    leaf_ids
    |> Enum.flat_map(&parent_chain_for_leaf/1)
    |> Enum.uniq()
  end

  defp prune_parent_ids(parent_ids, active_leaf_ids) do
    active_leaf_set = MapSet.new(active_leaf_ids)

    parent_ids
    |> Enum.filter(fn parent_id ->
      Enum.any?(active_leaf_set, fn leaf_id ->
        parent_id in parent_chain_for_leaf(leaf_id)
      end)
    end)
  end

  defp parent_chain_for_leaf(leaf_id) do
    case parse_leaf_id(leaf_id) do
      {:shop_item, _item_id} ->
        [Constants.notice_parent_tab_shop(), Constants.notice_parent_menu_main()]

      {:quest, _quest_id} ->
        [Constants.notice_parent_tab_quest(), Constants.notice_parent_menu_main()]

      {:achievement, _achievement_id} ->
        [Constants.notice_parent_tab_achievements(), Constants.notice_parent_menu_main()]

      {:feature_locked, _feature_id} ->
        []

      {:area, _area_key} ->
        [Constants.notice_parent_area_dropdown()]

      {:sage_tip, _level} ->
        []

      {:static, static_id}
      when static_id in [
             @notice_leaf_tab_shop_button,
             @notice_leaf_tab_quest_button,
             @notice_leaf_tab_achievements_button,
             @notice_leaf_tab_menu_any_button
           ] ->
        [Constants.notice_parent_menu_main()]

      {:static, static_id} when static_id == @notice_leaf_area_dropdown_button ->
        [Constants.notice_parent_area_dropdown()]

      :unknown ->
        []
    end
  end

  defp parse_leaf_id(leaf_id) do
    cond do
      String.starts_with?(leaf_id, "leaf.area.") and String.ends_with?(leaf_id, ".go_button") ->
        area_key =
          leaf_id
          |> String.trim_leading("leaf.area.")
          |> String.trim_trailing(".go_button")

        {:area, area_key}

      String.starts_with?(leaf_id, "leaf.sage_tip.") and
          String.ends_with?(leaf_id, ".confirm_button") ->
        level_value =
          leaf_id
          |> String.trim_leading("leaf.sage_tip.")
          |> String.trim_trailing(".confirm_button")

        case Integer.parse(level_value) do
          {level, ""} -> {:sage_tip, level}
          _ -> :unknown
        end

      String.starts_with?(leaf_id, "leaf.shop_item.") and
          String.ends_with?(leaf_id, ".purchase_button") ->
        item_id =
          leaf_id
          |> String.trim_leading("leaf.shop_item.")
          |> String.trim_trailing(".purchase_button")

        {:shop_item, item_id}

      String.starts_with?(leaf_id, "leaf.feature.") and String.ends_with?(leaf_id, ".locked_text") ->
        feature_id =
          leaf_id
          |> String.trim_leading("leaf.feature.")
          |> String.trim_trailing(".locked_text")

        {:feature_locked, feature_id}

      String.starts_with?(leaf_id, "leaf.quest.") and String.ends_with?(leaf_id, ".claim_button") ->
        quest_id =
          leaf_id
          |> String.trim_leading("leaf.quest.")
          |> String.trim_trailing(".claim_button")

        {:quest, quest_id}

      String.starts_with?(leaf_id, "leaf.achievement.") and String.ends_with?(leaf_id, ".unlocked") ->
        achievement_id =
          leaf_id
          |> String.trim_leading("leaf.achievement.")
          |> String.trim_trailing(".unlocked")

        {:achievement, achievement_id}

      leaf_id in [
        Constants.notice_leaf_area_dropdown_button(),
        Constants.notice_leaf_tab_shop_button(),
        Constants.notice_leaf_tab_quest_button(),
        Constants.notice_leaf_tab_achievements_button(),
        Constants.notice_leaf_tab_menu_any_button()
      ] ->
        {:static, leaf_id}

      true ->
        :unknown
    end
  end

  defp purchased_feature?(state, item_id) do
    case item_id do
      "idle_mode" -> state.features.idle_mode_purchased
      "sisu_generator" -> state.features.sisu_generator_purchased
      "bonus_time" -> state.features.bonus_time_purchased
      _ -> false
    end
  end

  defp non_sage_area_leaf_id?(leaf_id) do
    case parse_leaf_id(leaf_id) do
      {:area, "sage"} -> false
      {:area, _area_key} -> true
      _ -> false
    end
  end
end
