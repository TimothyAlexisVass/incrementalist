import { drawButton } from '../ui/components.js';
import { formatInteger } from '../format.js';
import {
  DAILY_BONUS_BUTTON_FONT,
  DAILY_BONUS_ENTRANCE_FONT,
  DAILY_BONUS_LABEL_FONT,
  DAILY_BONUS_TITLE_FONT
} from '../config.js';
import { getDailyBonusUIState } from './evaluate.js';
import { renderChestDrawStage } from './games/chest-draw/render.js';
import { CHEST_DRAW_GAME } from './games/chest-draw/index.js';
import { renderPrizeWheelStage } from './games/prize-wheel/render.js';
import { PRIZE_WHEEL_GAME } from './games/prize-wheel/index.js';
import { renderChecklistStage } from './games/checklist/render.js';
import {
  getCardPickCardIndexAtPoint,
  renderCardPickStage
} from './games/card-pick/render.js';
import {
  CARD_PICK_GAME,
  CARD_PICK_SESSION_STATUS
} from './games/card-pick/index.js';
import { isChecklistGame } from './games/checklist/index.js';

const BONUS_TEXT = 'BONUSTIME';
const HUE_ROTATION_MS = 444;
const ROLL_REVEAL_MS = 620;
const ROLL_START_DELAY_MS = 180;
const RESULT_SETTLE_MS = 420;
const WHEEL_SPIN_START_DELAY_MS = 140;
const WHEEL_SPIN_MS = 1650;
const WHEEL_SPIN_PAUSE_MS = 260;
const WHEEL_RESULT_SETTLE_MS = 520;
const CHECKLIST_CHECK_MS = 720;
const CHECKLIST_RESULT_SETTLE_MS = 360;

const charWidthCache = new Map();

export function drawBonusTimeText(ctx, x, y, now = getNowMs(), options = {}) {
  if (!ctx) return;

  const {
    font = DAILY_BONUS_ENTRANCE_FONT,
    alpha = 1,
    shadow = true,
    color = null
  } = options;

  if (color) {
    drawSolidBonusTimeText(ctx, BONUS_TEXT, x, y, font, {
      alpha,
      shadow,
      color
    });
    return;
  }

  drawHueRotatedText(ctx, BONUS_TEXT, x, y, font, now, {
    alpha,
    shadow,
    baseHue: 0,
    endHue: 280
  });
}

export function renderDailyBonusModal(ctx, canvas, gameState, modalState = {}) {
  if (!ctx || !canvas || !modalState.open) {
    return null;
  }

  const now = getNowMs();
  const uiState = getDailyBonusUIState(gameState.dailyBonus);
  const result = uiState.cardPickSession || modalState.result || null;
  const gameId = result?.gameId || uiState.gameId;
  const reveal = getRevealState(gameId, result, modalState.openedAt, now);
  const layout = createModalLayout(canvas, {
    showOpenButton: !result && gameId !== CARD_PICK_GAME.id,
    showDoneButton: Boolean(result && reveal.complete)
  });

  drawBackdrop(ctx, canvas);
  drawModalHeader(ctx, canvas, uiState, now);
  renderDailyBonusGameContent(ctx, layout, uiState, result, reveal, now, gameId);
  drawModalButtons(ctx, layout, uiState, result, reveal);
  drawModalMessage(ctx, canvas, modalState, now);

  return layout;
}

export function resolveDailyBonusModalAction(layout, x, y) {
  if (!layout) {
    return { action: null, insideModal: false };
  }

  if (layout.openRect && pointInRect(layout.openRect, x, y)) {
    return { action: 'daily_bonus_play', insideModal: true };
  }

  if (layout.doneRect && pointInRect(layout.doneRect, x, y)) {
    return { action: 'daily_bonus_close', insideModal: true };
  }

  const cardIndex = getCardPickCardIndexAtPoint(layout, x, y);
  if (cardIndex !== null) {
    return { action: 'card_pick_card', cardIndex, insideModal: true };
  }

  return { action: null, insideModal: true };
}

function createModalLayout(canvas, options = {}) {
  const centerX = canvas.width / 2;
  const buttonY = canvas.height - 74;
  const stageY = 142;
  const horizontalMargin = Math.max(64, Math.floor(canvas.width * 0.065));
  const stageRect = {
    x: horizontalMargin,
    y: stageY,
    width: canvas.width - (horizontalMargin * 2),
    height: Math.max(280, buttonY - stageY - 18)
  };
  const openRect = { x: centerX - 95, y: buttonY, width: 190, height: 42 };
  const doneRect = { x: centerX - 70, y: buttonY, width: 140, height: 42 };

  return {
    modalRect: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    openRect: options.showOpenButton ? openRect : null,
    doneRect: options.showDoneButton ? doneRect : null,
    stageRect,
    checklistRect: stageRect,
    cardPickBoardRect: null,
    cardPickCardRects: []
  };
}

function drawBackdrop(ctx, canvas) {
  ctx.fillStyle = 'rgba(4, 7, 16, 0.95)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, 'rgba(180, 42, 68, 0.2)');
  gradient.addColorStop(0.52, 'rgba(32, 88, 130, 0.16)');
  gradient.addColorStop(1, 'rgba(128, 58, 178, 0.2)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawModalHeader(ctx, canvas, uiState, now) {
  drawHueRotatedText(ctx, 'BONUS TIME', canvas.width / 2, 78, DAILY_BONUS_TITLE_FONT, now, {
    alpha: 1,
    shadow: true,
    baseHue: 0,
    endHue: 280
  });

  ctx.fillStyle = '#aebfd8';
  ctx.font = DAILY_BONUS_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(
    `Daily Tokens: ${formatInteger(uiState.dailyTokens)}   Special Tokens: ${formatInteger(uiState.specialTokens)}   Streak: ${formatInteger(uiState.streak)}`,
    canvas.width / 2,
    116
  );
}

function drawModalButtons(ctx, layout, uiState, result, reveal) {
  if (!result) {
    drawButton(ctx, layout.openRect, uiState.canPlay ? getPlayButtonLabel(uiState.gameId) : 'No Bonus Token', {
      active: uiState.canPlay,
      activeSurface: '#295d82',
      inactiveSurface: '#2a3140',
      activeBorder: '#8ed5ff',
      inactiveBorder: '#566172',
      textColor: uiState.canPlay ? '#f7fbff' : '#aeb8c6',
      lineWidth: 2,
      font: DAILY_BONUS_BUTTON_FONT,
      textY: layout.openRect.y + 25
    });
  } else if (reveal.complete) {
    drawButton(ctx, layout.doneRect, 'Done', {
      active: false,
      activeSurface: '#294d3c',
      inactiveSurface: '#294d3c',
      activeBorder: '#8ce8b5',
      inactiveBorder: '#8ce8b5',
      textColor: '#f6fff9',
      lineWidth: 2,
      font: DAILY_BONUS_BUTTON_FONT,
      textY: layout.doneRect.y + 25
    });
  }
}

function drawModalMessage(ctx, canvas, modalState, now) {
  if (!modalState.message) {
    return;
  }

  const elapsed = Math.max(0, now - (Number(modalState.messageAt) || now));
  const alpha = Math.max(0, Math.min(1, 1 - elapsed / 1800));
  if (alpha <= 0) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffd1dc';
  ctx.font = DAILY_BONUS_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(modalState.message, canvas.width / 2, canvas.height - 104);
  ctx.restore();
}

function renderDailyBonusGameContent(ctx, layout, uiState, result, reveal, now, gameId) {
  if (isChecklistGame(gameId)) {
    renderChecklistStage(ctx, layout, uiState, result, reveal, now);
    return;
  }

  switch (gameId) {
    case 'coin_rain':
      // Interaction is handled separately, but we could add a holding stage here if needed.
      break;
    case PRIZE_WHEEL_GAME.id:
      renderPrizeWheelStage(ctx, layout, result, reveal, now);
      break;
    case CARD_PICK_GAME.id:
      renderCardPickStage(ctx, layout, result, reveal, now);
      break;
    case CHEST_DRAW_GAME.id:
    default:
      renderChestDrawStage(ctx, layout, result, reveal, now);
      break;
  }
}

function getPlayButtonLabel(gameId) {
  if (isChecklistGame(gameId)) {
    return 'Check Off';
  }

  switch (gameId) {
    case PRIZE_WHEEL_GAME.id:
      return 'Spin';
    case CARD_PICK_GAME.id:
      return 'Pick Cards';
    case CHEST_DRAW_GAME.id:
    default:
      return 'Open Chest';
  }
}

function getRevealState(gameId, result, openedAt, now) {
  if (isChecklistGame(gameId)) {
    return getChecklistRevealState(result, openedAt, now);
  }

  if (gameId === PRIZE_WHEEL_GAME.id) {
    return getPrizeWheelRevealState(result, openedAt, now);
  }

  if (gameId === CARD_PICK_GAME?.id) {
    return getCardPickRevealState(result, openedAt, now);
  }

  return getRollRevealState(result, openedAt, now);
}

function getCardPickRevealState(result, openedAt, now) {
  if (!result || !result.rolls) {
    return {
      visibleRollCount: 0,
      currentRollIndex: -1,
      complete: false,
      animating: false,
      spinProgress: 0
    };
  }

  const complete = result.status === CARD_PICK_SESSION_STATUS.COMPLETE
    || result.action === 'card_pick_complete';
  const visibleRollCount = Array.isArray(result.rolls) ? result.rolls.length : 0;

  return {
    visibleRollCount,
    currentRollIndex: Math.max(0, visibleRollCount - 1),
    complete,
    animating: false,
    spinProgress: 0
  };
}

function getChecklistRevealState(result, openedAt, now) {
  if (!result) {
    return {
      visibleRollCount: 0,
      currentRollIndex: -1,
      complete: false,
      animating: false,
      spinProgress: 0,
      checkProgress: 0
    };
  }

  const elapsed = Math.max(0, now - (Number(openedAt) || now));
  const checkProgress = Math.min(Math.max(elapsed / CHECKLIST_CHECK_MS, 0), 1);
  const complete = elapsed >= CHECKLIST_CHECK_MS + CHECKLIST_RESULT_SETTLE_MS;

  return {
    visibleRollCount: complete ? 1 : 0,
    currentRollIndex: 0,
    complete,
    animating: !complete,
    spinProgress: 0,
    checkProgress
  };
}

function getRollRevealState(result, openedAt, now) {
  if (!result?.rolls?.length) {
    return {
      visibleRollCount: 0,
      currentRollIndex: -1,
      complete: false,
      animating: false,
      spinProgress: 0
    };
  }

  const elapsed = Math.max(0, now - (Number(openedAt) || now));
  const revealElapsed = Math.max(0, elapsed - ROLL_START_DELAY_MS);
  const visibleRollCount = Math.min(
    result.rolls.length,
    Math.floor(revealElapsed / ROLL_REVEAL_MS) + (elapsed >= ROLL_START_DELAY_MS ? 1 : 0)
  );
  const complete = elapsed >= ROLL_START_DELAY_MS + (result.rolls.length * ROLL_REVEAL_MS) + RESULT_SETTLE_MS;

  return {
    visibleRollCount,
    currentRollIndex: Math.max(0, visibleRollCount - 1),
    complete,
    animating: !complete,
    spinProgress: 0
  };
}

function getPrizeWheelRevealState(result, openedAt, now) {
  if (!result?.spins?.length) {
    return {
      visibleRollCount: 0,
      currentRollIndex: -1,
      complete: false,
      animating: false,
      spinProgress: 0
    };
  }

  const elapsed = Math.max(0, now - (Number(openedAt) || now));
  const revealElapsed = Math.max(0, elapsed - WHEEL_SPIN_START_DELAY_MS);
  const perSpinMs = WHEEL_SPIN_MS + WHEEL_SPIN_PAUSE_MS;
  const totalMotionMs = (result.spins.length * WHEEL_SPIN_MS)
    + (Math.max(0, result.spins.length - 1) * WHEEL_SPIN_PAUSE_MS);
  const currentRollIndex = Math.min(
    result.spins.length - 1,
    Math.max(0, Math.floor(revealElapsed / perSpinMs))
  );
  const currentSpinElapsed = Math.max(0, revealElapsed - (currentRollIndex * perSpinMs));
  const spinProgress = Math.min(Math.max(currentSpinElapsed / WHEEL_SPIN_MS, 0), 1);
  let visibleRollCount = 0;

  for (let i = 0; i < result.spins.length; i += 1) {
    if (revealElapsed >= (i * perSpinMs) + WHEEL_SPIN_MS) {
      visibleRollCount += 1;
    }
  }

  const complete = revealElapsed >= totalMotionMs + WHEEL_RESULT_SETTLE_MS;

  return {
    visibleRollCount: Math.min(result.spins.length, visibleRollCount),
    currentRollIndex,
    complete,
    animating: !complete,
    spinProgress
  };
}

function drawHueRotatedText(ctx, text, x, y, font, now, options = {}) {
  const {
    alpha = 1,
    shadow = false,
    baseHue = 0,
    endHue = 280
  } = options;
  const letters = String(text).split('');
  const hueShift = ((now % HUE_ROTATION_MS) / HUE_ROTATION_MS) * 360;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.globalAlpha = alpha;

  let fontCache = charWidthCache.get(font);
  if (!fontCache) {
    fontCache = new Map();
    charWidthCache.set(font, fontCache);
  }

  let totalWidth = 0;
  const widths = new Array(letters.length);

  for (let i = 0; i < letters.length; i += 1) {
    const letter = letters[i];
    let width = fontCache.get(letter);
    if (width === undefined) {
      width = ctx.measureText(letter).width;
      fontCache.set(letter, width);
    }
    widths[i] = width;
    totalWidth += width;
  }

  let cursorX = x - (totalWidth / 2);
  const colorSteps = Math.max(1, letters.length - 1);

  if (shadow) {
    ctx.shadowColor = 'rgba(255, 255, 255, 0.42)';
    ctx.shadowBlur = 12;
  }

  for (let i = 0; i < letters.length; i += 1) {
    const letter = letters[i];
    const normalized = i / colorSteps;
    const hue = (baseHue + (normalized * endHue) + hueShift) % 360;
    ctx.fillStyle = `hsl(${hue}, 94%, 64%)`;
    ctx.fillText(letter, cursorX, y);
    cursorX += widths[i];
  }

  ctx.restore();
}

function drawSolidBonusTimeText(ctx, text, x, y, font, options = {}) {
  const {
    alpha = 1,
    shadow = false,
    color = '#ffffff'
  } = options;

  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.globalAlpha = alpha;

  if (shadow) {
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    ctx.shadowBlur = 10;
  }

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function pointInRect(rect, x, y) {
  return Boolean(rect)
    && x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}
