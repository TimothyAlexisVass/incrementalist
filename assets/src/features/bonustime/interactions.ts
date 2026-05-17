import { InteractionState } from "../../ui/managers/interactions";
import { ServerState } from "../../net/snapshots";
import { DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT } from "../../config";
import { getActiveGameId } from "./view-model";
import { handleChestDrawInteractions, getChestState, ChestState } from "./01-chest-draw/interactions";
import { getChestDrawData } from "./01-chest-draw/view-model";
import { handlePrizeWheelInteractions, getWheelState, WheelState } from "./02-prize-wheel/interactions";
import { getPrizeWheelData } from "./02-prize-wheel/view-model";
import { handleResourceChecklistInteractions, getResourceChecklistState, ResourceChecklistState } from "./03-resource-checklist/interactions";
import { getResourceChecklistData } from "./03-resource-checklist/view-model";
import { handleItemChecklistInteractions, getItemChecklistState, ItemChecklistState } from "./05-item-checklist/interactions";
import { getItemChecklistData } from "./05-item-checklist/view-model";
import { GameChannel } from "../../net/game-channel";

export interface BonusTimeInteractionsResult {
  type: 'open_last_reward' | 'open_chest_reward' | 'none';
}

export function handleBonusTimeInteractions(
  input: InteractionState,
  state: ServerState,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
): BonusTimeInteractionsResult {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return { type: 'none' };

  const db = snapshot.state.bonustime;
  const hasToken = snapshot.state.has_bonustime_token || db.special_tokens > 0;
  const activeGameId = getActiveGameId(state);
  const isGameInProgress = (activeGameId === "chest_draw" && getChestState() !== ChestState.IDLE) ||
                           (activeGameId === "prize_wheel" && getWheelState() !== WheelState.IDLE) ||
                           (activeGameId === "resource_checklist" && getResourceChecklistState() !== ResourceChecklistState.IDLE) ||
                           (activeGameId === "item_checklist" && getItemChecklistState() !== ItemChecklistState.IDLE);

  // Intercept interaction if player is locked out (no tokens)
  if (!hasToken && !isGameInProgress) {
    if (db.last_result?.tier) {
      const centerX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2;
      const centerY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT / 2;
      const btnRect = { x: centerX - 100, y: centerY + 60, width: 200, height: 40 };

      const isOverBtn = input.pointer &&
                        input.pointer.x >= btnRect.x && input.pointer.x <= btnRect.x + btnRect.width &&
                        input.pointer.y >= btnRect.y && input.pointer.y <= btnRect.y + btnRect.height;

      if (isOverBtn && input.clicked && !input.consumed) {
        input.consumed = true;
        return { type: 'open_chest_reward' };
      }
    }
    return { type: 'none' };
  }

  // 1. Sub-game interactions
  const centerX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2;
  const centerY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT / 2;
  const size = 300;
  const gameRect = {
    x: centerX - size / 2,
    y: centerY - size / 2,
    width: size,
    height: size
  };

  if (activeGameId === 'chest_draw') {
    const data = getChestDrawData(state);
    if (data) {
      const intent = handleChestDrawInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === 'open_modal') {
        return { type: 'open_chest_reward' };
      }
    }
  } else if (activeGameId === 'prize_wheel') {
    const data = getPrizeWheelData(state);
    if (data) {
      const intent = handlePrizeWheelInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === 'open_modal') {
        return { type: 'open_chest_reward' };
      }
    }
  } else if (activeGameId === 'resource_checklist') {
    const data = getResourceChecklistData(state);
    if (data) {
      const intent = handleResourceChecklistInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === 'open_modal') {
        return { type: 'open_chest_reward' };
      }
    }
  } else if (activeGameId === 'item_checklist') {
    const data = getItemChecklistData(state);
    if (data) {
      const intent = handleItemChecklistInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === 'open_modal') {
        return { type: 'open_chest_reward' };
      }
    }
  }

  return { type: 'none' };
}
