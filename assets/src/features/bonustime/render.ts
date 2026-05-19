import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { hexToRgba } from "../../utils";
import { ServerState } from "../../net/snapshots";
import { COLORS } from "../../colors";
import { 
  DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT,
  BONUSTIME_TITLE_FONT, BONUSTIME_TIMER_FONT, MODAL_BODY_FONT, BONUSTIME_BUTTON_FONT
} from "../../config";
import { renderRewardModal, RewardModalState } from "../../ui/components/modals/reward-modal";
import { getActiveGameId, getActiveGameName, getTimeUntilNextTokenMs } from "./view-model";
import { renderChestDraw } from "./01-chest-draw/render";
import { getChestDrawData } from "./01-chest-draw/view-model";
import { renderPrizeWheel } from "./02-prize-wheel/render";
import { getPrizeWheelData } from "./02-prize-wheel/view-model";
import { resolveUpdatingText } from "../../utils/text";
import { drawButton } from "../../ui/components/button";
import { InteractionState } from "../../ui/managers/interactions";

import { getChestState, ChestState } from "./01-chest-draw/interactions";
import { getWheelState, WheelState } from "./02-prize-wheel/interactions";
import { renderResourceChecklist } from "./03-resource-checklist/render";
import { getResourceChecklistData } from "./03-resource-checklist/view-model";
import { getResourceChecklistState, ResourceChecklistState } from "./03-resource-checklist/interactions";
import { renderItemChecklist } from "./05-item-checklist/render";
import { getItemChecklistData } from "./05-item-checklist/view-model";
import { getItemChecklistState, ItemChecklistState } from "./05-item-checklist/interactions";
import { renderPlinkoDrop } from "./15-plinko-drop/render";
import { getPlinkoDropData } from "./15-plinko-drop/view-model";
import { getPlinkoState, PlinkoState } from "./15-plinko-drop/interactions";
import { renderJackpotMeter } from "./jackpot-meter/render";
import { getJackpotMeterData } from "./jackpot-meter/view-model";
import { getJackpotState, JackpotState } from "./jackpot-meter/interactions";
import { renderCoinRain } from "./04-coin-rain/render";
import { getCoinRainData } from "./04-coin-rain/view-model";
import { getCoinRainState, CoinRainState } from "./04-coin-rain/interactions";

export function renderBonusTimeOverview(
  canvas: HTMLCanvasElement,
  state: ServerState,
  activeRewardModal: RewardModalState | null,
  input: InteractionState
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return;

  const db = snapshot.state.bonustime;

  // Background
  renderer.drawRect({
    x: DISPLAY_AREA_X, y: DISPLAY_AREA_Y, width: DISPLAY_AREA_WIDTH, height: DISPLAY_AREA_HEIGHT,
    color: hexToRgba(COLORS.panel.bg)
  });

  const activeGameId = getActiveGameId(state);
  const hasToken = activeGameId === "jackpot_meter"
    ? !!snapshot.state.has_bonustime_token
    : (snapshot.state.has_bonustime_token || db.special_tokens > 0);

  const isGameInProgress = (activeGameId === "chest_draw" && getChestState() !== ChestState.IDLE) ||
                           (activeGameId === "prize_wheel" && getWheelState() !== WheelState.IDLE) ||
                           (activeGameId === "resource_checklist" && getResourceChecklistState() !== ResourceChecklistState.IDLE) ||
                           (activeGameId === "item_checklist" && getItemChecklistState() !== ItemChecklistState.IDLE) ||
                           (activeGameId === "plinko_drop" && getPlinkoState() !== PlinkoState.IDLE) ||
                           (activeGameId === "jackpot_meter" && getJackpotState() !== JackpotState.IDLE) ||
                           (activeGameId === "coin_rain" && getCoinRainState() !== CoinRainState.IDLE);
  const centerX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2;
  const centerY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT / 2;

  if (!hasToken && !isGameInProgress) {
    // Render the unified global cooldown screen instead of the active game!
    const remainingMs = getTimeUntilNextTokenMs(state);
    const countdownStr = formatCountdown(remainingMs);
    const stableCountdown = resolveUpdatingText("bonustime_countdown", countdownStr, (text) => renderer.isTextReady({
      text,
      font: BONUSTIME_TIMER_FONT,
      color: "#edf2f7",
      align: 'center',
      baseline: 'middle'
    }));

    renderer.drawText({
      text: "TIME UNTIL NEXT ENTRY",
      x: centerX, y: centerY - 60, font: MODAL_BODY_FONT,
      color: "#718096", align: 'center', baseline: 'middle'
    });

    renderer.drawText({
      text: stableCountdown,
      x: centerX, y: centerY, font: BONUSTIME_TIMER_FONT,
      color: "#edf2f7", align: 'center', baseline: 'middle'
    });

    if (db.last_result?.tier) {
      const btnRect = { x: centerX - 100, y: centerY + 60, width: 200, height: 40 };
      const isOverBtn = input.pointer &&
                        input.pointer.x >= btnRect.x && input.pointer.x <= btnRect.x + btnRect.width &&
                        input.pointer.y >= btnRect.y && input.pointer.y <= btnRect.y + btnRect.height;
      drawButton(btnRect, "VIEW LAST REWARD", {
        font: BONUSTIME_BUTTON_FONT,
        active: !!isOverBtn
      });
    }

    // Reward Modal
    if (activeRewardModal && activeRewardModal.open) {
      renderRewardModal(canvas, activeRewardModal);
    }
    return;
  }

  const rect = { x: DISPLAY_AREA_X, y: DISPLAY_AREA_Y, width: DISPLAY_AREA_WIDTH, height: DISPLAY_AREA_HEIGHT };

  if (activeGameId === "chest_draw") {
    const data = getChestDrawData(state);
    if (data) {
      renderChestDraw(data, rect);
    }
  } else if (activeGameId === "prize_wheel") {
    const data = getPrizeWheelData(state);
    if (data) {
      renderPrizeWheel(data, rect);
    }
  } else if (activeGameId === "resource_checklist") {
    const data = getResourceChecklistData(state);
    if (data) {
      renderResourceChecklist(data, rect);
    }
  } else if (activeGameId === "item_checklist") {
    const data = getItemChecklistData(state);
    if (data) {
      renderItemChecklist(data, rect);
    }
  } else if (activeGameId === "plinko_drop") {
    const data = getPlinkoDropData(state);
    if (data) {
      renderPlinkoDrop(data, rect, input.pointer);
    }
  } else if (activeGameId === "jackpot_meter") {
    const data = getJackpotMeterData(state);
    if (data) {
      renderJackpotMeter(data, rect);
    }
  } else if (activeGameId === "coin_rain") {
    const data = getCoinRainData(state);
    if (data) {
      renderCoinRain(data, rect);
    }
  } else {
    renderer.drawText({
      text: `[ ${getActiveGameName(state).toUpperCase()} COMING SOON ]`,
      x: centerX,
      y: centerY,
      font: BONUSTIME_TITLE_FONT,
      color: "#ffffff",
      alpha: 0.4,
      align: 'center', baseline: 'middle'
    });
  }

  // Reward Modal
  if (activeRewardModal && activeRewardModal.open) {
    renderRewardModal(canvas, activeRewardModal);
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
