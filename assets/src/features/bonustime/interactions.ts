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
  if (!snapshot || !snapshot.state.daily_bonus) return { type: 'none' };

  const db = snapshot.state.daily_bonus;

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
