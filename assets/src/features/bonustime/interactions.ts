import { InteractionState } from "../../ui/managers/interactions";
import { ServerState } from "../../net/snapshots";
import { DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT } from "../../config";
import { getActiveGameId } from "./view-model";
import { handleChestDrawInteractions } from "./01-chest-draw/interactions";
import { getChestDrawData } from "./01-chest-draw/view-model";
import { GameChannel } from "../../net/game-channel";

export interface BonusTimeInteractionsResult {
  type: 'open_last_reward' | 'open_chest_reward' | 'none';
}

export function handleBonusTimeInteractions(
  input: InteractionState,
  state: ServerState,
  channel?: GameChannel
): BonusTimeInteractionsResult {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return { type: 'none' };

  const db = snapshot.state.bonustime;
  const hasToken = snapshot.state.has_bonustime_token || db.special_tokens > 0;

  // Intercept interaction if player is locked out (no tokens)
  if (!hasToken) {
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
  const activeGameId = getActiveGameId(state);
  if (activeGameId === 'chest_draw') {
    const data = getChestDrawData(state);
    if (data) {
      const intent = handleChestDrawInteractions(input, data, {
        x: DISPLAY_AREA_X,
        y: DISPLAY_AREA_Y,
        width: DISPLAY_AREA_WIDTH,
        height: DISPLAY_AREA_HEIGHT
      }, channel);

      if (intent?.type === 'open_modal') {
        return { type: 'open_chest_reward' };
      }
    }
  }

  return { type: 'none' };
}
