import {
  BAR_COLLECTION_GLOW_FADE_MULTIPLIER,
  BAR_FULL_PULSE_SPEED,
  BAR_RESET_LERP_SPEED,
  TOP_HUD_EXP_BAR_HEIGHT,
  TOP_HUD_EXP_BAR_WIDTH,
  TOP_HUD_EXP_BAR_X,
  TOP_HUD_EXP_BAR_Y,
  TOP_HUD_EXP_COUNTER_X,
  TOP_HUD_EXP_COUNTER_Y,
  TOP_HUD_HEIGHT,
  TOP_HUD_LEVEL_X,
  TOP_HUD_CURRENCY_ICON_SIZE,
  TOP_HUD_COIN_COUNTER_Y,
  TOP_HUD_COINS_COUNTER_RIGHT,
  TOP_HUD_SHARDS_COUNTER_RIGHT,
  TOP_HUD_CORES_COUNTER_RIGHT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_HEIGHT,
  BOTTOM_HUD_HEIGHT,
  TOP_HUD_LEVEL_FONT,
  TOP_HUD_EXP_FONT,
  TOP_HUD_COINS_FONT,
  BOTTOM_HUD_BUTTON_FONT,
} from './config.js';
import { COLORS } from './colors.js';
import { AREAS } from './areas/list.js';
import { renderAreaSpecifics } from './areas/index.js';
import { renderProgressBar } from './progress-bar/render.js';
import { renderFloatingTexts, renderParticles } from './effects.js';
import { drawButton, drawHorizontalBar } from './ui/components.js';
import { formatNumber, formatNumberRatio, formatShortLevel } from './format.js';
import { spawnGpuProgressCompletionBurst } from './webgl-effects.js';
import { drawCurrencyAmount } from './currency-icons.js';
import { drawBonusTimeText } from './daily-bonus/render.js';
import { getSpendableBonusTokenCount } from './daily-bonus/state.js';
import { LOCKED_ELEMENT_IDS } from './locked-elements.js';
import { drawLockedText, drawLockedElement } from './utils.js';

const areaBackgroundImages = new Map();
const TWO_PI = Math.PI * 2;
const EXP_BAR_FULL_PULSE_MAX = 1.6;
const EXP_BAR_COLLECTION_GLOW_FADE_MS = (Math.PI * 165) / (
  BAR_FULL_PULSE_SPEED * BAR_COLLECTION_GLOW_FADE_MULTIPLIER
);
const MAX_EXP_BAR_LEVEL_UP_PARTICLES = 228;
const EXP_BAR_LEVEL_UP_PARTICLE_GRAVITY = 520;
const EXP_BAR_LEVEL_UP_PARTICLE_LIFE_MULTIPLIER = 2;
const EXP_BAR_LEVEL_UP_COLORS = Object.freeze([
  COLORS.bar.exp.fillStart,
  COLORS.bar.exp.fillEnd,
  '#ffffff',
  COLORS.rewards.expGain
]);
const EXP_BAR_VISUAL_STATE = {
  displayedRatio: 0,
  collectionGlowStartedAt: 0,
  lastTimestamp: 0,
  particles: []
};

function getAreaBackgroundImage(areaKey) {
  if (!areaBackgroundImages.has(areaKey)) {
    const image = new Image();
    image.src = `images/${areaKey}_background.png`;
    areaBackgroundImages.set(areaKey, image);
  }

  return areaBackgroundImages.get(areaKey);
}

function renderAreaBackground(ctx, canvas, state) {
  const areaKey = state.area;
  const area = AREAS[areaKey];

  if (!area) {
    ctx.fillStyle = COLORS.game.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const image = getAreaBackgroundImage(areaKey);

  if (image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT);
    return;
  }

  ctx.fillStyle = COLORS.game.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function triggerExpBarLevelUpEffect() {
  EXP_BAR_VISUAL_STATE.displayedRatio = 1;
  EXP_BAR_VISUAL_STATE.collectionGlowStartedAt = getNowMs();
  spawnExpBarLevelUpBurst();
}

export function renderTopHud(ctx, canvas, state) {
  ctx.fillStyle = COLORS.hud.panel;
  ctx.fillRect(0, 0, canvas.width, TOP_HUD_HEIGHT);

  ctx.fillStyle = COLORS.hud.textPrimary;
  ctx.font = TOP_HUD_LEVEL_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(formatShortLevel(state.level), TOP_HUD_LEVEL_X, 35);

  const now = getNowMs();
  const deltaTime = getExpBarVisualDelta(now);
  const expProgress = clamp01(state.exp / state.requiredExp);
  const displayedExpProgress = updateDisplayedExpRatio(expProgress, deltaTime);
  const collectionPulse = getExpBarCollectionGlowPulse(now);

  updateExpBarLevelUpParticles(deltaTime);

  drawHorizontalBar(ctx, {
    x: TOP_HUD_EXP_BAR_X,
    y: TOP_HUD_EXP_BAR_Y,
    width: TOP_HUD_EXP_BAR_WIDTH,
    height: TOP_HUD_EXP_BAR_HEIGHT,
    ratio: displayedExpProgress,
    gradientStops: [
      { offset: 0, color: COLORS.bar.exp.fillStart },
      { offset: 1, color: COLORS.bar.exp.fillEnd }
    ],
    trackColor: COLORS.bar.track,
    borderColor: COLORS.bar.border,
    lineWidth: 2
  });

  renderExpBarCollectionGlow(ctx, collectionPulse);
  renderExpBarLevelUpParticles(ctx);

  ctx.fillStyle = COLORS.hud.textPrimary;
  ctx.font = TOP_HUD_EXP_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(
    `${formatNumberRatio(state.exp, state.requiredExp)} EXP`,
    TOP_HUD_EXP_COUNTER_X,
    TOP_HUD_EXP_COUNTER_Y
  );

  drawTopHudCurrency(ctx, canvas, 'coins', state.coins, TOP_HUD_COINS_COUNTER_RIGHT);
  drawTopHudCurrency(ctx, canvas, 'shards', state.shards, TOP_HUD_SHARDS_COUNTER_RIGHT);
  drawTopHudCurrency(ctx, canvas, 'cores', state.cores, TOP_HUD_CORES_COUNTER_RIGHT);
}

function drawTopHudCurrency(ctx, canvas, currencyKey, amount, counterRight) {
  const textColor = COLORS.hud[currencyKey];

  drawCurrencyAmount(
    ctx,
    currencyKey,
    amount,
    canvas.width - counterRight,
    TOP_HUD_COIN_COUNTER_Y,
    TOP_HUD_CURRENCY_ICON_SIZE,
    {
      align: 'right',
      font: TOP_HUD_COINS_FONT,
      textColor,
      iconGap: 6,
      iconPosition: 'right'
    }
  );
}

function clamp01(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function getExpBarVisualDelta(now) {
  if (!EXP_BAR_VISUAL_STATE.lastTimestamp) {
    EXP_BAR_VISUAL_STATE.lastTimestamp = now;
    return 16.67;
  }

  const deltaTime = Math.min(Math.max(now - EXP_BAR_VISUAL_STATE.lastTimestamp, 0), 80);
  EXP_BAR_VISUAL_STATE.lastTimestamp = now;
  return deltaTime;
}

function updateDisplayedExpRatio(targetRatio, deltaTime) {
  const target = clamp01(targetRatio);
  const current = clamp01(EXP_BAR_VISUAL_STATE.displayedRatio);

  if (target >= current) {
    EXP_BAR_VISUAL_STATE.displayedRatio = target;
    return target;
  }

  const deltaSeconds = Math.max(0, deltaTime) / 1000;
  const lerpAmount = 1 - Math.exp(-BAR_RESET_LERP_SPEED * deltaSeconds);
  const next = current + (target - current) * lerpAmount;

  EXP_BAR_VISUAL_STATE.displayedRatio = Math.abs(next - target) < 0.001
    ? target
    : next;

  return EXP_BAR_VISUAL_STATE.displayedRatio;
}

function getExpBarCollectionGlowPulse(now) {
  const startedAt = EXP_BAR_VISUAL_STATE.collectionGlowStartedAt;
  if (!startedAt) {
    return 0;
  }

  const progress = clamp01((now - startedAt) / EXP_BAR_COLLECTION_GLOW_FADE_MS);
  if (progress >= 1) {
    EXP_BAR_VISUAL_STATE.collectionGlowStartedAt = 0;
    return 0;
  }

  return EXP_BAR_FULL_PULSE_MAX * Math.cos(progress * Math.PI * 0.5);
}

function renderExpBarCollectionGlow(ctx, collectionPulse) {
  if (collectionPulse <= 0) {
    return;
  }

  const glowPower = collectionPulse;
  const collectionFade = clamp01(collectionPulse / EXP_BAR_FULL_PULSE_MAX);
  const glowAlpha = Math.min(
    0.62,
    collectionFade * 0.16 + glowPower * 0.36 + collectionFade * 0.18
  );

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = rgbaHexToCss(COLORS.bar.exp.fillEnd, 0.8 * collectionFade);
  ctx.shadowBlur = 8 + 34 * glowPower;
  ctx.strokeStyle = rgbaHexToCss(COLORS.bar.exp.fillEnd, glowAlpha);
  ctx.lineWidth = 1 + collectionFade + 4 * glowPower;
  ctx.strokeRect(
    TOP_HUD_EXP_BAR_X + 0.5,
    TOP_HUD_EXP_BAR_Y + 0.5,
    TOP_HUD_EXP_BAR_WIDTH - 1,
    TOP_HUD_EXP_BAR_HEIGHT - 1
  );

  if (collectionPulse > 0) {
    ctx.shadowColor = `rgba(255, 255, 255, ${0.7 * collectionFade})`;
    ctx.shadowBlur = 24 + 22 * collectionFade;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * collectionFade})`;
    ctx.lineWidth = 0.5 + 3.5 * collectionFade;
    ctx.strokeRect(
      TOP_HUD_EXP_BAR_X - 1,
      TOP_HUD_EXP_BAR_Y - 1,
      TOP_HUD_EXP_BAR_WIDTH + 2,
      TOP_HUD_EXP_BAR_HEIGHT + 2
    );
  }

  ctx.restore();
}

function rgbaHexToCss(color, alpha) {
  const hex = String(color || '').trim().replace(/^#/, '');
  const expanded = hex.length === 3
    ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    : hex;
  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return `rgba(255, 255, 255, ${clamp01(alpha)})`;
  }

  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${clamp01(alpha)})`;
}

function spawnExpBarLevelUpBurst() {
  if (spawnGpuProgressCompletionBurst(
    TOP_HUD_EXP_BAR_X,
    TOP_HUD_EXP_BAR_Y,
    TOP_HUD_EXP_BAR_WIDTH,
    TOP_HUD_EXP_BAR_HEIGHT,
    EXP_BAR_LEVEL_UP_COLORS,
    {
      countMultiplier: 3,
      gravity: EXP_BAR_LEVEL_UP_PARTICLE_GRAVITY,
      lifeMultiplier: EXP_BAR_LEVEL_UP_PARTICLE_LIFE_MULTIPLIER
    }
  )) {
    return;
  }

  const centerX = TOP_HUD_EXP_BAR_X + TOP_HUD_EXP_BAR_WIDTH / 2;
  const centerY = TOP_HUD_EXP_BAR_Y + TOP_HUD_EXP_BAR_HEIGHT / 2;

  for (let i = 0; i < 126; i += 1) {
    const originX = TOP_HUD_EXP_BAR_X + Math.random() * TOP_HUD_EXP_BAR_WIDTH;
    const originY = TOP_HUD_EXP_BAR_Y + Math.random() * TOP_HUD_EXP_BAR_HEIGHT;
    const outwardAngle = Math.atan2(originY - centerY, originX - centerX);
    const angle = outwardAngle + (Math.random() - 0.5) * 0.8;
    const speed = 90 + Math.random() * 240;
    const color = EXP_BAR_LEVEL_UP_COLORS[Math.floor(Math.random() * EXP_BAR_LEVEL_UP_COLORS.length)];

    EXP_BAR_VISUAL_STATE.particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.93 + Math.random() * 0.04,
      radius: 1.2 + Math.random() * 2.6,
      lineWidth: 1 + Math.random() * 1.2,
      color,
      gravity: EXP_BAR_LEVEL_UP_PARTICLE_GRAVITY,
      elapsedMs: 0,
      lifeMs: (480 + Math.random() * 460) * EXP_BAR_LEVEL_UP_PARTICLE_LIFE_MULTIPLIER
    });
  }

  for (let i = 0; i < 42; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.35;
    const speed = 120 + Math.random() * 220;
    const color = EXP_BAR_LEVEL_UP_COLORS[Math.floor(Math.random() * EXP_BAR_LEVEL_UP_COLORS.length)];

    EXP_BAR_VISUAL_STATE.particles.push({
      x: TOP_HUD_EXP_BAR_X + Math.random() * TOP_HUD_EXP_BAR_WIDTH,
      y: TOP_HUD_EXP_BAR_Y + Math.random() * 6,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.92 + Math.random() * 0.04,
      radius: 1 + Math.random() * 2.1,
      lineWidth: 0.9 + Math.random() * 1.1,
      color,
      gravity: EXP_BAR_LEVEL_UP_PARTICLE_GRAVITY,
      elapsedMs: 0,
      lifeMs: (440 + Math.random() * 420) * EXP_BAR_LEVEL_UP_PARTICLE_LIFE_MULTIPLIER
    });
  }

  if (EXP_BAR_VISUAL_STATE.particles.length > MAX_EXP_BAR_LEVEL_UP_PARTICLES) {
    EXP_BAR_VISUAL_STATE.particles.splice(
      0,
      EXP_BAR_VISUAL_STATE.particles.length - MAX_EXP_BAR_LEVEL_UP_PARTICLES
    );
  }
}

function updateExpBarLevelUpParticles(deltaTime) {
  const particles = EXP_BAR_VISUAL_STATE.particles;
  if (particles.length === 0) return;

  const deltaSeconds = deltaTime / 1000;
  let writeIndex = 0;

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    particle.elapsedMs += deltaTime;

    if (particle.elapsedMs >= particle.lifeMs) {
      continue;
    }

    const drag = Math.pow(particle.drag, deltaTime / 16.67);
    particle.vx *= drag;
    particle.vy = particle.vy * drag + (particle.gravity || 0) * deltaSeconds;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particles[writeIndex] = particle;
    writeIndex += 1;
  }

  particles.length = writeIndex;
}

function renderExpBarLevelUpParticles(ctx) {
  const particles = EXP_BAR_VISUAL_STATE.particles;
  if (particles.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    const lifeProgress = particle.elapsedMs / particle.lifeMs;
    const alpha = Math.pow(Math.max(0, 1 - lifeProgress), 1.35);
    const tailScale = 0.018 + (1 - lifeProgress) * 0.024;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = particle.color;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 11 * alpha;
    ctx.lineWidth = particle.lineWidth;

    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(
      particle.x - particle.vx * tailScale,
      particle.y - particle.vy * tailScale
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (0.7 + alpha * 0.4), 0, TWO_PI);
    ctx.fill();
  }

  ctx.restore();
}

export function getBottomHudMenuButtonRect(canvas) {
  const width = 111;
  const height = 30;
  const rightMargin = 20;
  const bottomY = (canvas?.height ?? 760) - BOTTOM_HUD_HEIGHT;
  const canvasWidth = canvas?.width ?? 1280;

  return {
    x: canvasWidth - rightMargin - width,
    y: bottomY + ((BOTTOM_HUD_HEIGHT - height) / 2),
    width,
    height
  };
}

function hasSpendableBonusToken(state) {
  return getSpendableBonusTokenCount(state?.dailyBonus) > 0;
}

function hasBonusTimeUnlocked(state) {
  return Boolean(state?.features?.bonusTimePurchased);
}

export function getBottomHudButtonRects(canvas, state = null) {
  const buttonHeight = 30;
  const bottomY = (canvas?.height ?? 760) - BOTTOM_HUD_HEIGHT;
  const buttonY = bottomY + ((BOTTOM_HUD_HEIGHT - buttonHeight) / 2);
  const canvasWidth = canvas?.width ?? 1280;

  const areaSelectRect = {
    x: 16,
    y: buttonY,
    width: 130,
    height: buttonHeight,
    key: 'area'
  };

  const menuRect = {
    x: canvasWidth - 111 - 16,
    y: buttonY,
    width: 111,
    height: buttonHeight,
    key: 'menu'
  };

  const bonusTimeEligible = hasSpendableBonusToken(state);
  const bonusTimeRect = {
    x: Math.floor((canvasWidth - 240) / 2),
    y: buttonY - 2,
    width: 240,
    height: buttonHeight + 4,
    key: 'bonusTime',
    eligible: bonusTimeEligible,
    lockedElementId: bonusTimeEligible && !hasBonusTimeUnlocked(state) ? LOCKED_ELEMENT_IDS.bonusTime : null
  };

  return {
    areaSelectRect,
    questsRect: null,
    statsRect: null,
    shopRect: null,
    menuRect,
    bonusTimeRect,
    buttons: [areaSelectRect, menuRect]
  };
}

export function renderAreaDropdown(ctx, state, buttonRect) {
  if (!ctx || !buttonRect) return null;

  const availableAreas = [];
  for (const [key, area] of Object.entries(AREAS)) {
    if (key === state.area) continue;
    const isLocked = area.unlockLevel && state.level < area.unlockLevel;
    availableAreas.push({ key, name: area.name, isLocked, unlockLevel: area.unlockLevel });
  }

  if (availableAreas.length === 0) return null;

  const itemHeight = 30;
  const padding = 4;
  const menuWidth = Math.max(130, buttonRect.width);
  const menuHeight = (availableAreas.length * itemHeight) + (padding * 2);

  const menuRect = {
    x: buttonRect.x,
    y: buttonRect.y - menuHeight, // Drop up
    width: menuWidth,
    height: menuHeight
  };

  ctx.save();
  ctx.fillStyle = COLORS.hud.panel;
  ctx.fillRect(menuRect.x, menuRect.y, menuRect.width, menuRect.height);
  ctx.strokeStyle = COLORS.button.secondary.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(menuRect.x + 0.5, menuRect.y + 0.5, menuRect.width - 1, menuRect.height - 1);

  const itemRects = [];
  for (let i = 0; i < availableAreas.length; i++) {
    const area = availableAreas[i];
    const itemRect = {
      x: menuRect.x + padding,
      y: menuRect.y + padding + (i * itemHeight),
      width: menuRect.width - (padding * 2),
      height: itemHeight,
      key: area.key,
      isLocked: area.isLocked,
      unlockLevel: area.unlockLevel
    };

    const drawAreaButton = () => {
      drawButton(ctx, itemRect, area.name, {
        active: false,
        activeSurface: COLORS.button.secondary.surface,
        inactiveSurface: COLORS.button.secondary.surface,
        activeBorder: 'transparent',
        inactiveBorder: 'transparent',
        textColor: COLORS.button.secondary.text,
        lineWidth: 0,
        font: BOTTOM_HUD_BUTTON_FONT,
        textY: itemRect.y + 19
      });
    };

    if (area.isLocked) {
      drawLockedElement(ctx, itemRect, drawAreaButton);
    } else {
      drawAreaButton();
    }

    itemRects.push(itemRect);
  }

  ctx.restore();

  return { menuRect, itemRects };
}

export function renderGame(ctx, canvas, state, floatingTexts, particles = []) {
  if (!ctx || !canvas) return;

  ctx.fillStyle = COLORS.game.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  renderAreaBackground(ctx, canvas, state);

  renderAreaSpecifics(ctx, canvas, state);

  renderTopHud(ctx, canvas, state);

  renderProgressBar(ctx, canvas, state);

  const buttonRects = renderBottomHud(ctx, canvas, state);

  renderParticles(ctx, particles);
  renderFloatingTexts(ctx, floatingTexts);

  return buttonRects;
}

function renderBottomHud(ctx, canvas, state) {
  const y = canvas.height - BOTTOM_HUD_HEIGHT;
  ctx.fillStyle = COLORS.hud.panel;
  ctx.fillRect(0, y, canvas.width, BOTTOM_HUD_HEIGHT);

  const buttonRects = getBottomHudButtonRects(canvas, state);
  const { buttons, shopRect, menuRect, bonusTimeRect, areaSelectRect } = buttonRects;

  for (const button of buttons) {
    let bgColor;
    let borderColor;
    let textColor;
    let label;

    switch (button.key) {
      case 'shop':
        bgColor = COLORS.button.secondary.surface;
        borderColor = COLORS.button.secondary.border;
        textColor = COLORS.button.secondary.text;
        label = 'Shop [S]';
        break;
      case 'menu':
        bgColor = COLORS.button.secondary.surface;
        borderColor = COLORS.button.secondary.border;
        textColor = COLORS.button.secondary.text;
        label = 'Menu [ESC]';
        break;
      case 'area':
        bgColor = COLORS.button.secondary.surface;
        borderColor = COLORS.button.secondary.border;
        textColor = COLORS.button.secondary.text;
        label = AREAS[state.area]?.name || 'Unknown Area';
        break;
      default:
        continue;
    }

    drawButton(ctx, button, label, {
      active: false,
      activeSurface: bgColor,
      inactiveSurface: bgColor,
      activeBorder: borderColor,
      inactiveBorder: borderColor,
      textColor,
      lineWidth: 1,
      font: BOTTOM_HUD_BUTTON_FONT,
      textY: button.y + 19
    });
  }

  if (bonusTimeRect) {
    const textX = bonusTimeRect.x + (bonusTimeRect.width / 2);
    const textY = bonusTimeRect.y + 30;

    if (!bonusTimeRect.eligible) {
      drawBonusTimeText(ctx, textX, textY, undefined, {
        alpha: 0.72,
        shadow: false,
        color: '#8b94a3'
      });
    } else if (bonusTimeRect.lockedElementId) {
      drawBonusTimeText(ctx, textX, textY, undefined, {
        alpha: 0.16,
        shadow: false
      });
      drawLockedText(ctx, bonusTimeRect, {
        textY: bonusTimeRect.y + (bonusTimeRect.height / 2)
      });
    } else {
      drawBonusTimeText(
        ctx,
        textX,
        textY
      );
    }
  }

  return buttonRects;
}
