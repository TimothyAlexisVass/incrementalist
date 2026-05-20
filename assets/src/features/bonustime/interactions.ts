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
import { getPlinkoDropData } from "./15-plinko-drop/view-model";
import { handlePlinkoDropInteractions, getPlinkoState, PlinkoState } from "./15-plinko-drop/interactions";
import { getJackpotMeterData } from "./jackpot-meter/view-model";
import { handleJackpotMeterInteractions, getJackpotState, JackpotState } from "./jackpot-meter/interactions";
import { getCoinRainData } from "./04-coin-rain/view-model";
import { handleCoinRainInteractions, getCoinRainState, CoinRainState } from "./04-coin-rain/interactions";
import { getItsBonusTimeData } from "./18-its-bonus-time/view-model";
import { handleItsBonusTimeInteractions, getItsBonusTimeState, ItsBonusTimeState } from "./18-its-bonus-time/interactions";
import { getCardPickData } from "./09-card-pick/view-model";
import { handleCardPickInteractions, getCardPickState, CardPickState } from "./09-card-pick/interactions";
import { getRewardLabyrinthData } from "./07-reward-labyrinth/view-model";
import { handleLabyrinthInteractions, getLabyrinthState, LabyrinthState } from "./07-reward-labyrinth/interactions";
import { getMatchPairsData } from "./13-match-pairs/view-model";
import { handleMatchPairsInteractions, getMatchPairsState, MatchPairsState } from "./13-match-pairs/interactions";
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
  const activeGameId = getActiveGameId(state);

  // Jackpot Meter strictly requires daily tokens, no special tokens allowed.
  const hasToken = activeGameId === "jackpot_meter"
    ? !!snapshot.state.has_bonustime_token
    : (snapshot.state.has_bonustime_token || db.special_tokens > 0);

  const isGameInProgress = (activeGameId === "chest_draw" && getChestState() !== ChestState.IDLE) ||
                           (activeGameId === "prize_wheel" && getWheelState() !== WheelState.IDLE) ||
                           (activeGameId === "resource_checklist" && getResourceChecklistState() !== ResourceChecklistState.IDLE) ||
                           (activeGameId === "item_checklist" && getItemChecklistState() !== ItemChecklistState.IDLE) ||
                           (activeGameId === "plinko_drop" && getPlinkoState() !== PlinkoState.IDLE) ||
                           (activeGameId === "jackpot_meter" && getJackpotState() !== JackpotState.IDLE) ||
                           (activeGameId === "coin_rain" && getCoinRainState() !== CoinRainState.IDLE) ||
                           (activeGameId === "its_bonus_time" && getItsBonusTimeState() !== ItsBonusTimeState.IDLE) ||
                           (activeGameId === "card_pick" && getCardPickState() !== CardPickState.IDLE) ||
                           (activeGameId === "reward_labyrinth" && getLabyrinthState() !== LabyrinthState.IDLE) ||
                           (activeGameId === "match_pairs" && getMatchPairsState() !== MatchPairsState.IDLE);

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
  const gameRect = {
    x: DISPLAY_AREA_X,
    y: DISPLAY_AREA_Y,
    width: DISPLAY_AREA_WIDTH,
    height: DISPLAY_AREA_HEIGHT
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
  } else if (activeGameId === "plinko_drop") {
    const data = getPlinkoDropData(state);
    if (data) {
      const intent = handlePlinkoDropInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === "open_modal") {
        return { type: "open_chest_reward" };
      }
    }
  } else if (activeGameId === "jackpot_meter") {
    const data = getJackpotMeterData(state);
    if (data) {
      const intent = handleJackpotMeterInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === "open_modal") {
        return { type: "open_chest_reward" };
      }
    }
  } else if (activeGameId === "coin_rain") {
    const data = getCoinRainData(state);
    if (data) {
      const intent = handleCoinRainInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === "open_modal") {
        return { type: "open_chest_reward" };
      }
    }
  } else if (activeGameId === "its_bonus_time") {
    const data = getItsBonusTimeData(state);
    if (data) {
      const intent = handleItsBonusTimeInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === "open_modal") {
        return { type: "open_chest_reward" };
      }
    }
  } else if (activeGameId === "card_pick") {
    const data = getCardPickData(state);
    if (data) {
      const intent = handleCardPickInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === "open_modal") {
        return { type: "open_chest_reward" };
      }
    }
  } else if (activeGameId === "reward_labyrinth") {
    const data = getRewardLabyrinthData(state);
    if (data) {
      const intent = handleLabyrinthInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === "open_modal") {
        return { type: "open_chest_reward" };
      }
    }
  } else if (activeGameId === "match_pairs") {
    const data = getMatchPairsData(state);
    if (data) {
      const intent = handleMatchPairsInteractions(input, data, gameRect, channel, runCommand);

      if (intent?.type === "open_modal") {
        return { type: "open_chest_reward" };
      }
    }
  }

  return { type: 'none' };
}
