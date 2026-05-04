import {
  GENERIC_FLOAT_LIFE_MS,
  GENERIC_FLOAT_RISE_SPEED,
  REWARD_POPUP_FLY_MS,
  REWARD_POPUP_HOLD_MS,
  REWARD_POPUP_HOLD_RISE_SPEED,
  TOP_HUD_CORES_COUNTER_RIGHT,
  TOP_HUD_COIN_COUNTER_Y,
  TOP_HUD_EXP_COUNTER_X,
  TOP_HUD_EXP_COUNTER_Y,
  TOP_HUD_SHARDS_COUNTER_RIGHT,
  TOP_HUD_COINS_COUNTER_RIGHT,
  CANVAS_WIDTH,
  REWARD_POPUP_FONT,
} from './config.js';
import { COLORS } from './colors.js';

const TWO_PI = Math.PI * 2;
const CLICK_BURST_COLORS = Object.freeze([
  COLORS.rewards.coins,
  COLORS.rewards.shards,
  COLORS.rewards.cores,
  COLORS.rewards.achievement,
  COLORS.rewards.questSummary
]);
const MAX_CLICK_PARTICLES = 120;
const MAX_FLOATING_TEXTS = 72;
const TEXT_SPRITE_PADDING = 14;
const MAX_TEXT_SPRITE_CACHE = 96;
const REWARD_POPUP_MIN_RENDER_SIZE_PX = 1;
const textSpriteCache = new Map();

export function createFloatingTextState() {
  return [];
}

export function createParticleState() {
  return [];
}

export function spawnFloatingText(floatingTexts, text, x, y, color, options = {}) {
  if (!Array.isArray(floatingTexts)) return;

  floatingTexts.push({
    text: String(text ?? ''),
    x,
    y,
    startX: x,
    startY: y,
    color,
    alpha: 1.0,
    elapsedMs: 0,
    type: options.type || 'generic',
    targetX: options.targetX ?? x,
    targetY: options.targetY ?? y,
    holdMs: options.holdMs ?? 0,
    flyMs: options.flyMs ?? 0,
    riseSpeed: options.riseSpeed ?? GENERIC_FLOAT_RISE_SPEED,
    holdRiseSpeed: options.holdRiseSpeed ?? REWARD_POPUP_HOLD_RISE_SPEED,
    lifeMs: options.lifeMs ?? GENERIC_FLOAT_LIFE_MS,
    font: options.font || REWARD_POPUP_FONT,
    textAlign: options.textAlign || 'center',
    scale: options.scale ?? 1,
    minRenderSizePx: options.minRenderSizePx ?? 0,
    stackGroupId: options.stackGroupId ?? null,
    stackIndex: options.stackIndex ?? null
  });

  if (floatingTexts.length > MAX_FLOATING_TEXTS) {
    floatingTexts.splice(0, floatingTexts.length - MAX_FLOATING_TEXTS);
  }
}

export function spawnClickParticleBurst(particles, x, y, options = {}) {
  if (!Array.isArray(particles)) return;

  const count = options.count ?? Math.floor(8 + Math.random() * 7);
  const palette = options.colors || CLICK_BURST_COLORS;

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * TWO_PI;
    const speed = 80 + Math.random() * 180;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const radius = 1.5 + Math.random() * 2.7;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.92 + Math.random() * 0.04,
      radius,
      lineWidth: 1 + radius * 0.45,
      color,
      elapsedMs: 0,
      lifeMs: 320 + Math.random() * 260
    });
  }

  if (particles.length > MAX_CLICK_PARTICLES) {
    particles.splice(0, particles.length - MAX_CLICK_PARTICLES);
  }
}

export function getHudRewardTargets(canvas) {
  const canvasWidth = canvas?.width ?? CANVAS_WIDTH;

  return {
    exp: {
      x: TOP_HUD_EXP_COUNTER_X,
      y: TOP_HUD_EXP_COUNTER_Y
    },
    coins: { x: canvasWidth - TOP_HUD_COINS_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y },
    shards: { x: canvasWidth - TOP_HUD_SHARDS_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y },
    cores: { x: canvasWidth - TOP_HUD_CORES_COUNTER_RIGHT, y: TOP_HUD_COIN_COUNTER_Y }
  };
}

export function spawnRewardPopup(floatingTexts, canvas, text, x, y, color, targetKey) {
  const targets = getHudRewardTargets(canvas);
  const target = targets[targetKey] || targets.coins;

  spawnFloatingText(floatingTexts, text, x, y, color, {
    type: 'reward',
    targetX: target.x,
    targetY: target.y,
    holdMs: REWARD_POPUP_HOLD_MS,
    flyMs: REWARD_POPUP_FLY_MS,
    holdRiseSpeed: REWARD_POPUP_HOLD_RISE_SPEED,
    font: REWARD_POPUP_FONT,
    textAlign: 'center',
    minRenderSizePx: REWARD_POPUP_MIN_RENDER_SIZE_PX
  });
}

export function updateFloatingTexts(floatingTexts, deltaTime) {
  if (!Array.isArray(floatingTexts) || floatingTexts.length === 0) return;

  const deltaSeconds = deltaTime / 1000;
  let writeIndex = 0;

  for (let i = 0; i < floatingTexts.length; i += 1) {
    const ft = floatingTexts[i];
    ft.elapsedMs += deltaTime;

    if (ft.type === 'reward') {
      updateRewardPopup(ft);
    } else {
      ft.y -= ft.riseSpeed * deltaSeconds;
      ft.alpha = Math.max(0, 1 - (ft.elapsedMs / ft.lifeMs));
    }

    if (!shouldRemoveFloatingText(ft)) {
      floatingTexts[writeIndex] = ft;
      writeIndex += 1;
    }
  }

  floatingTexts.length = writeIndex;
}

export function updateParticles(particles, deltaTime) {
  if (!Array.isArray(particles)) return;

  const deltaSeconds = deltaTime / 1000;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.elapsedMs += deltaTime;

    if (particle.elapsedMs >= particle.lifeMs) {
      particles.splice(i, 1);
      continue;
    }

    const drag = Math.pow(particle.drag, deltaTime / 16.67);
    particle.vx *= drag;
    particle.vy *= drag;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
  }
}

export function renderParticles(ctx, particles) {
  if (!Array.isArray(particles) || particles.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.shadowBlur = 0;

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    const lifeProgress = particle.elapsedMs / particle.lifeMs;
    const alpha = Math.pow(Math.max(0, 1 - lifeProgress), 1.35);
    const tailScale = 0.018 + (1 - lifeProgress) * 0.012;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = particle.color;
    ctx.fillStyle = particle.color;
    ctx.lineWidth = particle.lineWidth;

    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(
      particle.x - particle.vx * tailScale,
      particle.y - particle.vy * tailScale
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (0.65 + alpha * 0.35), 0, TWO_PI);
    ctx.fill();
  }

  ctx.restore();
}

export function renderFloatingTexts(ctx, floatingTexts) {
  if (!Array.isArray(floatingTexts) || floatingTexts.length === 0) return;

  ctx.save();

  for (let i = 0; i < floatingTexts.length; i += 1) {
    const ft = floatingTexts[i];
    if (ft.alpha <= 0) continue;

    const sprite = getTextSprite(ctx, ft);
    const scale = getFloatingTextRenderScale(ft, sprite);
    if (scale <= 0) continue;

    ctx.globalAlpha = ft.alpha;
    ctx.drawImage(
      sprite.canvas,
      ft.x - getSpriteAnchorX(sprite, ft.textAlign) * scale,
      ft.y - sprite.anchorY * scale,
      sprite.canvas.width * scale,
      sprite.canvas.height * scale
    );
  }

  ctx.restore();
}

function getTextSprite(ctx, ft) {
  const key = `${ft.text}\u0000${ft.font}\u0000${ft.color}`;

  if (ft.spriteKey === key && ft.sprite) {
    return ft.sprite;
  }

  const cachedSprite = textSpriteCache.get(key);
  if (cachedSprite) {
    ft.spriteKey = key;
    ft.sprite = cachedSprite;
    return cachedSprite;
  }

  const sprite = createTextSprite(ctx, ft.text, ft.font, ft.color);
  textSpriteCache.set(key, sprite);

  if (textSpriteCache.size > MAX_TEXT_SPRITE_CACHE) {
    const oldestKey = textSpriteCache.keys().next().value;
    textSpriteCache.delete(oldestKey);
  }

  ft.spriteKey = key;
  ft.sprite = sprite;
  return sprite;
}

function createTextSprite(ctx, text, font, color) {
  ctx.save();
  ctx.font = font;
  const metrics = ctx.measureText(text);
  ctx.restore();

  const fontSize = parseFontSizePx(font);
  const textWidth = Math.ceil(metrics.width);
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent || fontSize * 0.82);
  const descent = Math.ceil(metrics.actualBoundingBoxDescent || fontSize * 0.28);
  const width = Math.max(1, textWidth + TEXT_SPRITE_PADDING * 2);
  const height = Math.max(1, ascent + descent + TEXT_SPRITE_PADDING * 2);
  const canvas = createSpriteCanvas(width, height);
  const spriteCtx = canvas.getContext('2d');
  const textX = TEXT_SPRITE_PADDING;
  const textY = TEXT_SPRITE_PADDING + ascent;

  spriteCtx.font = font;
  spriteCtx.textAlign = 'left';
  spriteCtx.textBaseline = 'alphabetic';
  spriteCtx.lineJoin = 'round';
  spriteCtx.lineWidth = 7;
  spriteCtx.strokeStyle = '#ffffff';
  spriteCtx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  spriteCtx.shadowBlur = 5;
  spriteCtx.shadowOffsetX = 2;
  spriteCtx.shadowOffsetY = 2;
  spriteCtx.strokeText(text, textX, textY);

  spriteCtx.shadowColor = 'transparent';
  spriteCtx.shadowBlur = 0;
  spriteCtx.shadowOffsetX = 0;
  spriteCtx.shadowOffsetY = 0;
  spriteCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  spriteCtx.fillText(text, textX - 1, textY);
  spriteCtx.fillText(text, textX + 1, textY);
  spriteCtx.fillText(text, textX, textY - 1);
  spriteCtx.fillText(text, textX, textY + 1);

  spriteCtx.fillStyle = color;
  spriteCtx.fillText(text, textX, textY);

  return {
    canvas,
    textWidth,
    anchorY: textY
  };
}

function createSpriteCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getSpriteAnchorX(sprite, textAlign) {
  switch (textAlign) {
    case 'center':
      return TEXT_SPRITE_PADDING + sprite.textWidth / 2;
    case 'right':
    case 'end':
      return TEXT_SPRITE_PADDING + sprite.textWidth;
    case 'left':
    case 'start':
    default:
      return TEXT_SPRITE_PADDING;
  }
}

function getFloatingTextRenderScale(ft, sprite) {
  const requestedScale = Number.isFinite(ft.scale) ? Math.max(0, ft.scale) : 1;
  const minRenderSizePx = Number.isFinite(ft.minRenderSizePx)
    ? Math.max(0, ft.minRenderSizePx)
    : 0;

  if (minRenderSizePx <= 0) {
    return requestedScale;
  }

  const largestSpriteDimension = Math.max(
    sprite?.canvas?.width ?? 0,
    sprite?.canvas?.height ?? 0,
    1
  );

  return Math.max(requestedScale, minRenderSizePx / largestSpriteDimension);
}

function parseFontSizePx(font) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || '');
  if (!match) {
    return 16;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 16;
}

function updateRewardPopup(ft) {
  const holdElapsed = Math.min(ft.elapsedMs, ft.holdMs);
  const holdDistance = ft.holdRiseSpeed * (holdElapsed / 1000);
  const holdY = ft.startY - holdDistance;

  if (ft.elapsedMs <= ft.holdMs) {
    ft.x = ft.startX;
    ft.y = holdY;
    ft.alpha = 1;
    ft.scale = 1;
    return;
  }

  const flyElapsed = ft.elapsedMs - ft.holdMs;
  const flyProgress = ft.flyMs > 0 ? Math.min(flyElapsed / ft.flyMs, 1) : 1;
  const eased = 1 - Math.pow(1 - flyProgress, 3);

  ft.x = ft.startX + (ft.targetX - ft.startX) * eased;
  ft.y = holdY + (ft.targetY - holdY) * eased;
  ft.alpha = Math.max(0, 1 - flyProgress);
  ft.scale = Math.max(0, 1 - flyProgress);
}

function shouldRemoveFloatingText(ft) {
  if (ft.type === 'reward') {
    return ft.elapsedMs >= ft.holdMs + ft.flyMs;
  }

  return ft.elapsedMs >= ft.lifeMs;
}
