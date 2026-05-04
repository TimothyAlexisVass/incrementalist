import {
  BOTTOM_HUD_BUTTON_FONT,
  BOTTOM_HUD_HEIGHT,
  SMALL_TEXT_FONT
} from './config.js';
import {
  DAILY_BONUS_SLOT_MS,
  getDailyBonusRotation,
  getUtcBoundaryStart
} from './daily-bonus/state.js';
import { formatInteger } from './format.js';
import { drawButton } from './ui/components.js';

const DEBUG_MODE = 'ON';

export const DEBUG_ENABLED = DEBUG_MODE === 'ON';

export function handleDebugKeydown(event, state) {
  if (!DEBUG_ENABLED || !event || !state?.progressBar) {
    return false;
  }

  if (event.key !== 'r' && event.key !== 'R') {
    return false;
  }

  state.progressBar.fill = 100;
  state.canClaim = true;
  return true;
}

export function renderDebugMenu(ctx, canvas, state, mousePoint) {
  if (!DEBUG_ENABLED || !ctx || !canvas || !state) {
    return null;
  }

  const hoverCornerSize = 20;
  const hoverCornerX = 0;
  const hoverCornerY = canvas.height - BOTTOM_HUD_HEIGHT;
  const isHoveringCorner = mousePoint &&
    mousePoint.x >= hoverCornerX && mousePoint.x <= hoverCornerX + hoverCornerSize &&
    mousePoint.y >= hoverCornerY && mousePoint.y <= hoverCornerY + hoverCornerSize;

  const panelRect = {
    x: 12,
    y: canvas.height - BOTTOM_HUD_HEIGHT + 7,
    width: 410,
    height: 36
  };

  const isHoveringMenu = mousePoint && pointInRect(panelRect, mousePoint.x, mousePoint.y);

  if (isHoveringCorner) {
    state.debugMenuVisible = true;
  } else if (!isHoveringMenu) {
    state.debugMenuVisible = false;
  }

  if (!state.debugMenuVisible) {
    return null;
  }
  const addDailyTokenRect = {
    x: panelRect.x + 66,
    y: panelRect.y + 5,
    width: 136,
    height: 26
  };
  const cycleBonusSlotRect = {
    x: panelRect.x + 210,
    y: panelRect.y + 5,
    width: 112,
    height: 26
  };
  const rotation = getDailyBonusRotation(state?.dailyBonus);

  ctx.save();
  ctx.fillStyle = 'rgba(8, 13, 24, 0.9)';
  ctx.fillRect(panelRect.x, panelRect.y, panelRect.width, panelRect.height);
  ctx.strokeStyle = '#7aa3d8';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelRect.x + 0.5, panelRect.y + 0.5, panelRect.width - 1, panelRect.height - 1);

  ctx.fillStyle = '#dbe8ff';
  ctx.font = SMALL_TEXT_FONT;
  ctx.textAlign = 'left';
  ctx.fillText('DEBUG', panelRect.x + 12, panelRect.y + 23);
  ctx.fillText(`Slot ${formatInteger(rotation.activeSlot)}`, panelRect.x + 334, panelRect.y + 23);
  ctx.restore();

  drawButton(ctx, addDailyTokenRect, 'Add Daily Token', {
    active: false,
    activeSurface: '#294d3c',
    inactiveSurface: '#294d3c',
    activeBorder: '#8ce8b5',
    inactiveBorder: '#8ce8b5',
    textColor: '#f6fff9',
    lineWidth: 1,
    font: BOTTOM_HUD_BUTTON_FONT,
    textY: addDailyTokenRect.y + 18
  });

  drawButton(ctx, cycleBonusSlotRect, 'Cycle Slot', {
    active: false,
    activeSurface: '#3d385f',
    inactiveSurface: '#3d385f',
    activeBorder: '#c2b8ff',
    inactiveBorder: '#c2b8ff',
    textColor: '#f3f0ff',
    lineWidth: 1,
    font: BOTTOM_HUD_BUTTON_FONT,
    textY: cycleBonusSlotRect.y + 18
  });

  return {
    panelRect,
    addDailyTokenRect,
    cycleBonusSlotRect
  };
}

export function resolveDebugMenuAction(layout, x, y) {
  if (!DEBUG_ENABLED || !layout) {
    return { action: null, insideDebugMenu: false };
  }

  if (pointInRect(layout.addDailyTokenRect, x, y)) {
    return { action: 'debug_add_daily_bonus_token', insideDebugMenu: true };
  }

  if (pointInRect(layout.cycleBonusSlotRect, x, y)) {
    return { action: 'debug_cycle_bonus_slot', insideDebugMenu: true };
  }

  return {
    action: null,
    insideDebugMenu: pointInRect(layout.panelRect, x, y)
  };
}

export function addDebugDailyBonusToken(state) {
  if (!DEBUG_ENABLED || !state?.dailyBonus) {
    return false;
  }

  state.dailyBonus.dailyTokens = toNonNegativeInteger(state.dailyBonus.dailyTokens) + 1;
  return true;
}

export function cycleDebugBonusSlot(state, now = Date.now()) {
  if (!DEBUG_ENABLED || !state?.dailyBonus) {
    return null;
  }

  const rotation = getDailyBonusRotation(state.dailyBonus, now);
  const nextBoundaryIndex = rotation.boundaryIndex + 1;

  state.dailyBonus.rotationAnchorUtc = getUtcBoundaryStart(now) - (nextBoundaryIndex * DAILY_BONUS_SLOT_MS);
  state.dailyBonus.lastTokenBoundaryIndex = nextBoundaryIndex;

  return getDailyBonusRotation(state.dailyBonus, now);
}

function toNonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function pointInRect(rect, x, y) {
  return Boolean(rect)
    && x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}
