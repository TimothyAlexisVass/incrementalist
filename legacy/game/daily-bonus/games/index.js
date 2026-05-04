import {
  CHEST_DRAW_GAME,
  getChestRollCount,
  rollChestDraw
} from './chest-draw/index.js';
import {
  PRIZE_WHEEL_GAME,
  getPrizeWheelSpinCount,
  spinPrizeWheel
} from './prize-wheel/index.js';
import {
  ITEM_CHECKLIST_GAME,
  RESOURCE_CHECKLIST_GAME,
  checkOffChecklist,
  isChecklistGame
} from './checklist/index.js';
import {
  COIN_RAIN_GAME,
  getCoinRainParameters,
  evaluateCoinRainResults
} from './coin-rain/index.js';
import {
  CARD_PICK_GAME,
  getCardPickCount,
  rollCardPick
} from './card-pick/index.js';

export const DAILY_BONUS_GAMES_BY_SLOT = Object.freeze({
  [CHEST_DRAW_GAME.slot]: CHEST_DRAW_GAME,
  [PRIZE_WHEEL_GAME.slot]: PRIZE_WHEEL_GAME,
  [RESOURCE_CHECKLIST_GAME.slot]: RESOURCE_CHECKLIST_GAME,
  [ITEM_CHECKLIST_GAME.slot]: ITEM_CHECKLIST_GAME,
  [COIN_RAIN_GAME.slot]: COIN_RAIN_GAME,
  [CARD_PICK_GAME.slot]: CARD_PICK_GAME
});

export function getDailyBonusGameForSlot(slot) {
  const normalizedSlot = Math.max(1, Math.floor(Number(slot) || 1));
  return DAILY_BONUS_GAMES_BY_SLOT[normalizedSlot] || CHEST_DRAW_GAME;
}

export function rollDailyBonusGame(game, options = {}) {
  const {
    dailyBonusState = null,
    randomFn = Math.random,
    streak = 0
  } = options;

  switch (game?.id) {
    case RESOURCE_CHECKLIST_GAME.id:
    case ITEM_CHECKLIST_GAME.id:
      return checkOffChecklist(dailyBonusState, game);
    case PRIZE_WHEEL_GAME.id:
      return spinPrizeWheel(streak, randomFn);
    case COIN_RAIN_GAME.id:
      return { status: 'requires_interaction', parameters: getCoinRainParameters(streak, randomFn) };
    case CARD_PICK_GAME.id:
      return rollCardPick(streak, randomFn);
    case CHEST_DRAW_GAME.id:
    default:
      return rollChestDraw(streak, randomFn);
  }
}

export function getDailyBonusAttemptCount(gameId, streak) {
  if (isChecklistGame(gameId)) {
    return 1;
  }

  switch (gameId) {
    case PRIZE_WHEEL_GAME.id:
      return getPrizeWheelSpinCount(streak);
    case COIN_RAIN_GAME.id:
      return 1; // Played once per activation
    case CARD_PICK_GAME.id:
      return getCardPickCount(streak);
    case CHEST_DRAW_GAME.id:
    default:
      return getChestRollCount(streak);
  }
}
