import { COLORS } from '../colors.js';
import { getProgressBarLayout } from '../progress-bar/render.js';
import { drawButton } from '../ui/components.js';
import { drawCurrencyAmount, measureCurrencyAmount } from '../currency-icons.js';
import {
  canPurchaseMaxSisuUpgrade,
  getSisuTierTarget
} from './mechanics.js';
import { SISU_BASE_MAX, MAX_SISU_UPGRADE_LEVEL } from './levels.js';
import { SISU_MIN_MULTIPLIER, SISU_REFILL_TIERS, getSisuMeterColorArray } from './state.js';
import {
  formatSisuMultiplier,
  formatCountRatio,
  formatMultiplierDelta,
  toFiniteNumber
} from '../format.js';
import {
  SISU_CURRENT_FONT,
  SISU_DECAY_FONT,
  SISU_MAX_FONT,
  SISU_METER_FONT,
  SISU_UPGRADE_BUTTON_FONT,
} from '../config.js';
import { LOCKED_ELEMENT_IDS } from '../locked-elements.js';
import { drawLockedElement, rgbArrayToCss } from '../utils.js';

export function renderSisuUI(ctx, canvas, state) {
  const sisu = Math.max(SISU_MIN_MULTIPLIER, toFiniteNumber(state.progressBar.sisu, SISU_MIN_MULTIPLIER));
  const displaySisu = Math.max(0, toFiniteNumber(state.sisu?.displayCurrent, sisu));
  const blueMax = state.sisu?.maxBasic || SISU_BASE_MAX;
  const purpleMax = blueMax * SISU_REFILL_TIERS.purple.multiplier;
  const isUnlocked = Boolean(state.features?.sisuGeneratorPurchased);

  const barRadius = 35;
  const progressBar = getProgressBarLayout(canvas);
  const centerX = progressBar.x + progressBar.width / 2;
  const centerY = progressBar.y + progressBar.height + 100;
  const controlRect = {
    x: centerX - barRadius,
    y: centerY - barRadius,
    width: barRadius * 2,
    height: barRadius + 42
  };
  let iconRects = [];

  const drawSisuControl = () => {
    // Meter border
    ctx.beginPath();
    ctx.arc(centerX, centerY, barRadius, Math.PI, 0, false);
    ctx.strokeStyle = COLORS.bar.border;
    ctx.lineWidth = 14;
    ctx.stroke();

    // Meter track
    ctx.beginPath();
    ctx.arc(centerX, centerY, barRadius, Math.PI, 0, false);
    ctx.strokeStyle = COLORS.bar.track;
    ctx.lineWidth = 12;
    ctx.stroke();

    const fillRatio = Math.min(1, displaySisu / purpleMax);
    if (fillRatio > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, barRadius, Math.PI, Math.PI + Math.PI * fillRatio, false);

      const fillColor = Array.isArray(state.sisu?.displayColor)
        ? state.sisu.displayColor
        : getSisuMeterColorArray(displaySisu, blueMax);

      ctx.strokeStyle = rgbArrayToCss(fillColor);
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.hud.textPrimary;
    ctx.font = SISU_MAX_FONT;
    ctx.textAlign = 'center';
    ctx.fillText(formatSisuMultiplier(sisu), centerX, centerY + 5);

    ctx.fillStyle = COLORS.sisu.decay;
    ctx.font = SISU_DECAY_FONT;
    ctx.fillText(`-${getCurrentSisuDiminishment(state).toFixed(2)}%/s`, centerX, centerY + 20);

    const iconY = centerY + 35;
    iconRects = [
      drawSisuHudIcon(ctx, centerX - 18, iconY, SISU_REFILL_TIERS.blue, getSisuTierTarget(state, 'blue')),
      drawSisuHudIcon(ctx, centerX, iconY, SISU_REFILL_TIERS.yellow, getSisuTierTarget(state, 'yellow')),
      drawSisuHudIcon(ctx, centerX + 18, iconY, SISU_REFILL_TIERS.purple, getSisuTierTarget(state, 'purple'))
    ];
  };

  if (!isUnlocked) {
    drawLockedElement(ctx, controlRect, drawSisuControl, { font: SISU_METER_FONT });
    return {
      lockedElementId: LOCKED_ELEMENT_IDS.sisuGenerator,
      controlRect,
      iconRects: []
    };
  }

  drawSisuControl();

  return {
    controlRect,
    iconRects
  };
}

export function renderSisuGeneratorModal(ctx, canvas, state) {
  if (!state.features?.sisuGeneratorPurchased) {
    return null;
  }

  const modalWidth = 520;
  const modalHeight = 330;
  const modalX = Math.floor((canvas.width - modalWidth) / 2);
  const modalY = Math.floor((canvas.height - modalHeight) / 2);
  const modalRect = {
    x: modalX,
    y: modalY,
    width: modalWidth,
    height: modalHeight
  };
  const closeRect = {
    x: modalX + modalWidth - 82,
    y: modalY + 14,
    width: 64,
    height: 28
  };

  ctx.fillStyle = COLORS.overlay.backdrop;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLORS.overlay.panel;
  ctx.fillRect(modalRect.x, modalRect.y, modalRect.width, modalRect.height);
  ctx.strokeStyle = COLORS.overlay.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(modalRect.x, modalRect.y, modalRect.width, modalRect.height);

  ctx.fillStyle = COLORS.overlay.titleText;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Sisu Generator', modalX + 24, modalY + 36);
  drawButton(ctx, closeRect, 'Close', { active: false });

  const currentSisu = Math.max(SISU_MIN_MULTIPLIER, toFiniteNumber(state.progressBar.sisu, SISU_MIN_MULTIPLIER));
  ctx.fillStyle = COLORS.sisu.blue;
  ctx.font = SISU_CURRENT_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(formatSisuMultiplier(currentSisu), modalX + modalWidth / 2, modalY + 88);

  ctx.fillStyle = COLORS.sisu.decay;
  ctx.font = SISU_MAX_FONT;
  ctx.fillText(`-${getCurrentSisuDiminishment(state).toFixed(2)}%/s`, modalX + modalWidth / 2, modalY + 116);

  const refillRects = [];
  const tierValues = Object.values(SISU_REFILL_TIERS);
  const refillWidth = 132;
  const refillHeight = 88;
  const refillGap = 22;
  const totalRefillWidth = (refillWidth * tierValues.length) + (refillGap * (tierValues.length - 1));
  const refillStartX = modalX + Math.floor((modalWidth - totalRefillWidth) / 2);
  const refillY = modalY + 144;

  for (let index = 0; index < tierValues.length; index += 1) {
    const tier = tierValues[index];
    const target = getSisuTierTarget(state, tier.id);
    const rect = {
      x: refillStartX + (index * (refillWidth + refillGap)),
      y: refillY,
      width: refillWidth,
      height: refillHeight
    };
    refillRects.push({ tier: tier.id, rect });
    drawSisuRefillControl(ctx, rect, tier, target, currentSisu);
  }

  const maxUpgradeLevel = state.sisu?.maxUpgradeLevel || 0;
  const blueMax = state.sisu?.maxBasic || SISU_BASE_MAX;
  ctx.fillStyle = COLORS.hud.textPrimary;
  ctx.font = SISU_MAX_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`Max Sisu: ${formatSisuMultiplier(blueMax, SISU_MIN_MULTIPLIER)} (Level ${formatCountRatio(maxUpgradeLevel, MAX_SISU_UPGRADE_LEVEL)})`, modalX + 38, modalY + 272);

  const upgradeRect = {
    x: modalX + modalWidth - 220,
    y: modalY + 248,
    width: 180,
    height: 36
  };
  const upgradeCheck = canPurchaseMaxSisuUpgrade(state);
  let upgradeLabel = `Upgrade ${formatMultiplierDelta(0.5)}`;
  let upgradeCost = null;
  let upgradePrefix = null;
  let upgradeDisabled = false;

  if (!upgradeCheck.canPurchase) {
    if (upgradeCheck.reason === 'MAX') {
      upgradeLabel = 'MAX';
    } else if (upgradeCheck.cost > 0) {
      upgradeLabel = '';
      upgradeCost = upgradeCheck.cost;
    } else {
      upgradeLabel = upgradeCheck.reason;
    }
    upgradeDisabled = true;
  } else {
    upgradeLabel = '';
    upgradePrefix = formatMultiplierDelta(0.5);
    upgradeCost = upgradeCheck.cost;
  }

  drawButton(ctx, upgradeRect, upgradeLabel, {
    active: false,
    activeSurface: upgradeDisabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
    inactiveSurface: upgradeDisabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
    activeBorder: upgradeDisabled ? COLORS.button.secondary.border : COLORS.button.border.active,
    inactiveBorder: upgradeDisabled ? COLORS.button.secondary.border : COLORS.button.border.active,
    textColor: COLORS.button.text,
    font: SISU_UPGRADE_BUTTON_FONT,
    textY: upgradeRect.y + 23
  });

  if (upgradeCost !== null) {
    drawUpgradeCostLabel(ctx, upgradeRect, upgradePrefix, upgradeCost);
  }

  return {
    modalRect,
    closeRect,
    refillRects,
    upgradeRect
  };
}

export function resolveSisuGeneratorModalAction(layout, x, y) {
  if (!layout) {
    return { action: null, insideModal: false };
  }

  if (pointInRect(layout.closeRect, x, y)) {
    return { action: 'sisu_modal_close', insideModal: true };
  }

  for (const refillRect of layout.refillRects || []) {
    if (pointInRect(refillRect.rect, x, y)) {
      return { action: 'sisu_refill', tier: refillRect.tier, insideModal: true };
    }
  }

  if (pointInRect(layout.upgradeRect, x, y)) {
    return { action: 'sisu_upgrade', insideModal: true };
  }

  if (!pointInRect(layout.modalRect, x, y)) {
    return { action: 'sisu_modal_close', insideModal: false };
  }

  return { action: null, insideModal: true };
}

function drawUpgradeCostLabel(ctx, rect, prefix, cost) {
  const textY = rect.y + 23;
  const iconSize = 18;
  const iconGap = 4;
  const currencyKey = 'shards';
  const textColor = COLORS.button.text;
  const leftText = prefix ? `${prefix} (` : '';
  const rightText = prefix ? ')' : '';

  ctx.save();
  ctx.font = SISU_UPGRADE_BUTTON_FONT;

  const leftWidth = leftText ? ctx.measureText(leftText).width : 0;
  const amountWidth = measureCurrencyAmount(ctx, cost, iconSize, {
    font: SISU_UPGRADE_BUTTON_FONT,
    iconGap
  });
  const rightWidth = rightText ? ctx.measureText(rightText).width : 0;
  const totalWidth = leftWidth + amountWidth + rightWidth;
  let currentX = rect.x + (rect.width / 2) - (totalWidth / 2);

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  if (leftText) {
    ctx.fillText(leftText, currentX, textY);
    currentX += leftWidth;
  }

  drawCurrencyAmount(ctx, currencyKey, cost, currentX, textY, iconSize, {
    align: 'left',
    font: SISU_UPGRADE_BUTTON_FONT,
    textColor,
    iconGap
  });
  currentX += amountWidth;

  if (rightText) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText(rightText, currentX, textY);
  }

  ctx.restore();
}

function drawSisuHudIcon(ctx, centerX, centerY, tier, target) {
  const rect = {
    tier: tier.id,
    x: centerX - 8,
    y: centerY - 8,
    width: 16,
    height: 16,
    target
  };

  ctx.beginPath();
  ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.sisu[tier.colorKey];
  ctx.fill();
  ctx.strokeStyle = COLORS.hud.textPrimary;
  ctx.lineWidth = 1;
  ctx.stroke();

  return rect;
}

function drawSisuRefillControl(ctx, rect, tier, target, currentSisu) {
  const canRefill = currentSisu < target;
  const tierColor = COLORS.sisu[tier.colorKey];

  ctx.fillStyle = canRefill ? COLORS.button.surface.active : COLORS.button.secondary.surface;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = canRefill ? tierColor : COLORS.button.secondary.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  const circleX = rect.x + rect.width / 2;
  const circleY = rect.y + 28;
  ctx.beginPath();
  ctx.arc(circleX, circleY, 14, 0, Math.PI * 2);
  ctx.fillStyle = tierColor;
  ctx.fill();
  ctx.strokeStyle = COLORS.button.text;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = COLORS.button.text;
  ctx.font = SISU_METER_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(tier.label, circleX, rect.y + 57);
  ctx.font = SISU_DECAY_FONT;
  ctx.fillText(formatSisuMultiplier(target), circleX, rect.y + 76);
}

function getCurrentSisuDiminishment(state) {
  return Math.max(0, Number(state.sisu?.diminishmentPerSecond) || 0);
}

function pointInRect(rect, x, y) {
  return Boolean(rect)
    && x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}
