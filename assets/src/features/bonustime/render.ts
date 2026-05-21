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
import { getChestState, ChestState, getRewardWaitStartedAt as getChestRewardWaitStartedAt } from "./01-chest-draw/interactions";
import { renderPrizeWheel } from "./02-prize-wheel/render";
import { getPrizeWheelData } from "./02-prize-wheel/view-model";
import { getWheelState, WheelState, getRewardWaitStartedAt as getWheelRewardWaitStartedAt } from "./02-prize-wheel/interactions";
import { renderResourceChecklist } from "./03-resource-checklist/render";
import { getResourceChecklistData } from "./03-resource-checklist/view-model";
import { getResourceChecklistState, ResourceChecklistState, getRewardWaitStartedAt as getResourceChecklistRewardWaitStartedAt } from "./03-resource-checklist/interactions";
import { resolveUpdatingText } from "../../utils/text";
import { drawButton } from "../../ui/components/button";
import { InteractionState } from "../../ui/managers/interactions";
import { renderItemChecklist } from "./05-item-checklist/render";
import { getItemChecklistData } from "./05-item-checklist/view-model";
import { getItemChecklistState, ItemChecklistState, getRewardWaitStartedAt as getItemChecklistRewardWaitStartedAt } from "./05-item-checklist/interactions";
import { renderPlinkoDrop } from "./15-plinko-drop/render";
import { getPlinkoDropData } from "./15-plinko-drop/view-model";
import { getPlinkoState, PlinkoState, getRewardWaitStartedAt as getPlinkoRewardWaitStartedAt } from "./15-plinko-drop/interactions";
import { renderJackpotMeter } from "./jackpot-meter/render";
import { getJackpotMeterData } from "./jackpot-meter/view-model";
import { getJackpotState, JackpotState, getRewardWaitStartedAt as getJackpotRewardWaitStartedAt } from "./jackpot-meter/interactions";
import { renderCoinRain } from "./04-coin-rain/render";
import { getCoinRainData } from "./04-coin-rain/view-model";
import { getCoinRainState, CoinRainState, getRewardWaitStartedAt as getCoinRainRewardWaitStartedAt } from "./04-coin-rain/interactions";
import { renderItsBonusTime } from "./18-its-bonus-time/render";
import { getItsBonusTimeData } from "./18-its-bonus-time/view-model";
import { getItsBonusTimeState, ItsBonusTimeState, getFinalRevealStartTime as getItsBonusTimeFinalRevealStartTime, getRemainingIndices as getItsBonusTimeRemainingIndices } from "./18-its-bonus-time/interactions";
import { renderCardPick } from "./09-card-pick/render";
import { getCardPickData } from "./09-card-pick/view-model";
import { getCardPickState, CardPickState, getFinalRevealStartTime as getCardPickFinalRevealStartTime, getRemainingIndices as getCardPickRemainingIndices, getBonusPhaseStartTime as getCardPickBonusPhaseStartTime } from "./09-card-pick/interactions";
import { renderLadderClimb } from "./08-ladder-climb/render";
import { getLadderClimbData } from "./08-ladder-climb/view-model";
import { getLadderClimbState, LadderClimbState, getRewardWaitStartedAt as getLadderClimbRewardWaitStartedAt } from "./08-ladder-climb/interactions";
import { renderRewardLabyrinth } from "./07-reward-labyrinth/render";
import { getRewardLabyrinthData } from "./07-reward-labyrinth/view-model";
import { getLabyrinthState, LabyrinthState, getRewardWaitStartedAt as getLabyrinthRewardWaitStartedAt } from "./07-reward-labyrinth/interactions";
import { renderMatchPairs } from "./13-match-pairs/render";
import { getMatchPairsData } from "./13-match-pairs/view-model";
import { getMatchPairsState, MatchPairsState, getFinalRevealStartTime as getMatchPairsFinalRevealStartTime, getRemainingIndices as getMatchPairsRemainingIndices } from "./13-match-pairs/interactions";
import { renderScratchCard } from "./12-scratch-card/render";
import { getScratchCardData } from "./12-scratch-card/view-model";
import { getScratchCardRewardWaitStartedAt, getScratchCardState, ScratchCardState } from "./12-scratch-card/interactions";
import { renderLuckyDice } from "./10-lucky-dice/render";
import { getLuckyDiceData } from "./10-lucky-dice/view-model";
import { getLuckyDiceFinalRevealStartedAt, getLuckyDiceState, LuckyDiceState } from "./10-lucky-dice/interactions";
import { BONUSTIME_REWARD_MODAL_DELAY_MS, renderBonusTimeRewardCountdownRing } from "./flow";

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
                           (activeGameId === "coin_rain" && getCoinRainState() !== CoinRainState.IDLE) ||
                           (activeGameId === "its_bonus_time" && getItsBonusTimeState() !== ItsBonusTimeState.IDLE) ||
                           (activeGameId === "card_pick" && getCardPickState() !== CardPickState.IDLE) ||
                           (activeGameId === "ladder_climb" && getLadderClimbState() !== LadderClimbState.IDLE) ||
                           (activeGameId === "reward_labyrinth" && getLabyrinthState() !== LabyrinthState.IDLE) ||
                           (activeGameId === "match_pairs" && getMatchPairsState() !== MatchPairsState.IDLE) ||
                           (activeGameId === "scratch_card" && getScratchCardState() !== ScratchCardState.IDLE) ||
                           (activeGameId === "lucky_dice" && getLuckyDiceState() !== LuckyDiceState.IDLE);
  const centerX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2;
  const centerY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT / 2;
  const now = performance.now();

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
  } else if (activeGameId === "its_bonus_time") {
    const data = getItsBonusTimeData(state);
    if (data) {
      renderItsBonusTime(data, rect, input.pointer);
    }
  } else if (activeGameId === "card_pick") {
    const data = getCardPickData(state);
    if (data) {
      renderCardPick(data, rect, input.pointer);
    }
  } else if (activeGameId === "ladder_climb") {
    const data = getLadderClimbData(state);
    if (data) {
      renderLadderClimb(data, rect, input.pointer);
    }
  } else if (activeGameId === "reward_labyrinth") {
    const data = getRewardLabyrinthData(state);
    if (data) {
      renderRewardLabyrinth(data, rect, input.pointer);
    }
  } else if (activeGameId === "match_pairs") {
    const data = getMatchPairsData(state);
    if (data) {
      renderMatchPairs(data, rect, input.pointer);
    }
  } else if (activeGameId === "scratch_card") {
    const data = getScratchCardData(state);
    if (data) {
      renderScratchCard(data, rect, input.pointer);
    }
  } else if (activeGameId === "lucky_dice") {
    const data = getLuckyDiceData(state);
    if (data) {
      renderLuckyDice(data, rect, input.pointer);
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

  if (!(activeRewardModal && activeRewardModal.open)) {
    renderActiveRewardCountdownOverlay(renderer, activeGameId, now);
  }

  // Reward Modal
  if (activeRewardModal && activeRewardModal.open) {
    renderRewardModal(canvas, activeRewardModal);
  }
}

function renderActiveRewardCountdownOverlay(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  activeGameId: string,
  now: number
) {
  const ringCenterX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - 34;
  const ringCenterY = DISPLAY_AREA_Y + 34;

  const drawRing = (
    remainingMs: number,
    totalMs: number,
    fillColor: string,
    trackColor = "#2d3748",
    backgroundColor = "#0b1220"
  ) => {
    renderBonusTimeRewardCountdownRing(renderer, {
      centerX: ringCenterX,
      centerY: ringCenterY,
      remainingMs,
      totalMs,
      radius: 16,
      thickness: 4,
      backgroundColor,
      trackColor,
      fillColor
    });
  };

  if (activeGameId === "chest_draw") {
    const startedAt = getChestRewardWaitStartedAt();
    if (getChestState() === ChestState.REVEALED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "prize_wheel") {
    const startedAt = getWheelRewardWaitStartedAt();
    if (getWheelState() === WheelState.SPUN && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "resource_checklist") {
    const startedAt = getResourceChecklistRewardWaitStartedAt();
    if (getResourceChecklistState() === ResourceChecklistState.REVEALED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "item_checklist") {
    const startedAt = getItemChecklistRewardWaitStartedAt();
    if (getItemChecklistState() === ItemChecklistState.REVEALED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "plinko_drop") {
    const startedAt = getPlinkoRewardWaitStartedAt();
    if (getPlinkoState() === PlinkoState.REVEALED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "jackpot_meter") {
    const startedAt = getJackpotRewardWaitStartedAt();
    if (getJackpotState() === JackpotState.REVEALED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "coin_rain") {
    const startedAt = getCoinRainRewardWaitStartedAt();
    if (getCoinRainState() === CoinRainState.REVEALED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "reward_labyrinth") {
    const startedAt = getLabyrinthRewardWaitStartedAt();
    if (getLabyrinthState() === LabyrinthState.FINISHED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "card_pick") {
    const state = getCardPickState();
    if (state === CardPickState.BONUS_PENDING) {
      const startedAt = getCardPickBonusPhaseStartTime();
      if (startedAt > 0) {
        drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#ffbe4d", "#6b4a12", "#120d24");
      }
    } else if (state === CardPickState.FINAL_REVEAL) {
      const startedAt = getCardPickFinalRevealStartTime();
      const revealMs = 2000 + (getCardPickRemainingIndices().length * 30);
      const totalMs = revealMs + BONUSTIME_REWARD_MODAL_DELAY_MS;
      if (startedAt > 0) {
        drawRing(totalMs - (now - startedAt), totalMs, "#52df87");
      }
    }
  } else if (activeGameId === "ladder_climb") {
    const startedAt = getLadderClimbRewardWaitStartedAt();
    if (getLadderClimbState() === LadderClimbState.REVEALED && startedAt > 0) {
      drawRing(BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt), BONUSTIME_REWARD_MODAL_DELAY_MS, "#52df87");
    }
  } else if (activeGameId === "its_bonus_time") {
    if (getItsBonusTimeState() === ItsBonusTimeState.FINAL_REVEAL) {
      const revealMs = 2000 + (getItsBonusTimeRemainingIndices().length * 20);
      const totalMs = revealMs + BONUSTIME_REWARD_MODAL_DELAY_MS;
      const finalRevealStartTime = getItsBonusTimeFinalRevealStartTime();
      if (finalRevealStartTime > 0) {
        drawRing(totalMs - (now - finalRevealStartTime), totalMs, "#52df87");
      }
    }
  } else if (activeGameId === "match_pairs") {
    if (getMatchPairsState() === MatchPairsState.FINAL_REVEAL) {
      const revealMs = 2000 + (getMatchPairsRemainingIndices().length * 20);
      const totalMs = revealMs + BONUSTIME_REWARD_MODAL_DELAY_MS;
      const finalRevealStartTime = getMatchPairsFinalRevealStartTime();
      if (finalRevealStartTime > 0) {
        drawRing(totalMs - (now - finalRevealStartTime), totalMs, "#52df87");
      }
    }
  } else if (activeGameId === "scratch_card") {
    const startedAt = getScratchCardRewardWaitStartedAt();
    if (getScratchCardState() === ScratchCardState.REVEALED && startedAt > 0) {
      drawRing(
        BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt),
        BONUSTIME_REWARD_MODAL_DELAY_MS,
        "#52df87"
      );
    }
  } else if (activeGameId === "lucky_dice") {
    const startedAt = getLuckyDiceFinalRevealStartedAt();
    if (getLuckyDiceState() === LuckyDiceState.FINAL_REVEALING && startedAt > 0) {
      drawRing(
        BONUSTIME_REWARD_MODAL_DELAY_MS - (now - startedAt),
        BONUSTIME_REWARD_MODAL_DELAY_MS,
        "#52df87"
      );
    }
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
