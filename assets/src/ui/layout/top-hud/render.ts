import { COLORS } from "../../../colors";
import {
  BAR_COLLECTION_GLOW_FADE_MULTIPLIER,
  BAR_FULL_PULSE_SPEED,
  TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_WIDTH, TOP_HUD_EXP_BAR_HEIGHT,
  TOP_HUD_LEVEL_X, TOP_HUD_EXP_COUNTER_X, TOP_HUD_EXP_COUNTER_Y,
  TOP_HUD_CURRENCY_ICON_SIZE, TOP_HUD_CURRENCY_ICON_Y,
  TOP_HUD_COINS_ICON_RIGHT, TOP_HUD_SHARDS_ICON_RIGHT, TOP_HUD_CORES_ICON_RIGHT,
  TOP_HUD_COIN_COUNTER_Y, TOP_HUD_COINS_COUNTER_RIGHT, TOP_HUD_SHARDS_COUNTER_RIGHT, TOP_HUD_CORES_COUNTER_RIGHT,
  TOP_HUD_LEVEL_FONT, TOP_HUD_EXP_FONT, TOP_HUD_COINS_FONT, BOTTOM_HUD_HEIGHT
} from "../../../config";
import { formatNumberRatio } from "../../../utils";
import { BigNum, compare, ZERO, toNumber } from "../../../core/bignum";
import { getRequiredExp } from "./progression";
import { getHudViewModel, getAndClearQueuedLevelUps } from "./view-model";
import { drawCurrencyAmount } from "../../../render/currency-icons";
import { spawnGpuProgressCompletionBurst } from "../../../render/webgl-effects";

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

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function rgbaHexToCss(color: string | readonly [number, number, number], alpha: number) {
  if (Array.isArray(color)) {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.min(Math.max(alpha, 0), 1)})`;
  }
  const hex = String(color || '').trim().replace(/^#/, '');
  const expanded = hex.length === 3 ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] : hex;
  const value = Number.parseInt(expanded, 16);
  if (!Number.isFinite(value)) return `rgba(255, 255, 255, ${Math.min(Math.max(alpha, 0), 1)})`;
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(Math.max(alpha, 0), 1)})`;
}

export function renderTopHUD(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dtMs: number) {
  const model = getHudViewModel();
  const now = getNowMs();

  const queued = getAndClearQueuedLevelUps();
  if (queued > 0) {
    spawnExpBarLevelUpBurst(model);
  }

  updateExpBarLevelUpParticles(model, dtMs);

  const startedAt = model.collectionGlowStartedAt;
  let collectionPulse = 0;
  if (startedAt > 0) {
    const progress = Math.min(Math.max((now - startedAt) / EXP_BAR_COLLECTION_GLOW_FADE_MS, 0), 1);
    if (progress >= 1) {
      model.collectionGlowStartedAt = 0;
    } else {
      collectionPulse = EXP_BAR_FULL_PULSE_MAX * Math.cos(progress * Math.PI * 0.5);
    }
  }

  ctx.fillStyle = COLORS.panel.bg;
  ctx.fillRect(0, 0, canvas.width, TOP_HUD_EXP_BAR_Y + TOP_HUD_EXP_BAR_HEIGHT + 16);

  ctx.fillStyle = COLORS.bar.track;
  ctx.fillRect(TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_WIDTH, TOP_HUD_EXP_BAR_HEIGHT);

  const requiredExp = getRequiredExp(model.displayedLevel);
  const fillRatio = Math.min(1, Math.max(0, toNumber(model.displayedExp) / toNumber(requiredExp)));

  const gradient = ctx.createLinearGradient(TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_X + TOP_HUD_EXP_BAR_WIDTH, TOP_HUD_EXP_BAR_Y);
  gradient.addColorStop(0, COLORS.bar.exp.fillStart);
  gradient.addColorStop(1, COLORS.bar.exp.fillEnd);

  ctx.fillStyle = gradient;
  ctx.fillRect(TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_WIDTH * fillRatio, TOP_HUD_EXP_BAR_HEIGHT);

  ctx.strokeStyle = COLORS.bar.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_WIDTH, TOP_HUD_EXP_BAR_HEIGHT);

  renderExpBarCollectionGlow(ctx, collectionPulse);
  renderExpBarLevelUpParticles(ctx, model);

  ctx.fillStyle = COLORS.panel.textPrimary;
  ctx.font = TOP_HUD_EXP_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${formatNumberRatio(model.displayedExp, requiredExp)} EXP`, TOP_HUD_EXP_COUNTER_X, TOP_HUD_EXP_COUNTER_Y);

  ctx.fillStyle = COLORS.panel.textPrimary;
  ctx.font = TOP_HUD_LEVEL_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(String(model.displayedLevel), TOP_HUD_LEVEL_X, 34);

  drawCurrency(ctx, canvas, "Coins", model.displayedCoins, COLORS.panel.coins, TOP_HUD_COINS_ICON_RIGHT, TOP_HUD_COINS_COUNTER_RIGHT);
  drawCurrency(ctx, canvas, "Shards", model.displayedShards, COLORS.panel.shards, TOP_HUD_SHARDS_ICON_RIGHT, TOP_HUD_SHARDS_COUNTER_RIGHT);
  drawCurrency(ctx, canvas, "Cores", model.displayedCores, COLORS.panel.cores, TOP_HUD_CORES_ICON_RIGHT, TOP_HUD_CORES_COUNTER_RIGHT);
}

function drawCurrency(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, label: string, amount: BigNum, color: string, iconRight: number, counterRight: number) {
  drawCurrencyAmount(
    ctx,
    label.toLowerCase(),
    amount,
    canvas.width - counterRight,
    TOP_HUD_COIN_COUNTER_Y,
    TOP_HUD_CURRENCY_ICON_SIZE,
    {
      align: 'right',
      font: TOP_HUD_COINS_FONT,
      textColor: color,
      iconGap: 6,
      iconPosition: 'right'
    }
  );
}

function renderExpBarCollectionGlow(ctx: CanvasRenderingContext2D, collectionPulse: number) {
  if (collectionPulse <= 0) return;

  const glowPower = collectionPulse;
  const collectionFade = Math.min(1, Math.max(0, collectionPulse / EXP_BAR_FULL_PULSE_MAX));
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

function spawnExpBarLevelUpBurst(model: ReturnType<typeof getHudViewModel>) {
  if (spawnGpuProgressCompletionBurst(
    TOP_HUD_EXP_BAR_X,
    TOP_HUD_EXP_BAR_Y,
    TOP_HUD_EXP_BAR_WIDTH,
    TOP_HUD_EXP_BAR_HEIGHT,
    EXP_BAR_LEVEL_UP_COLORS as any,
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
    const color = EXP_BAR_LEVEL_UP_COLORS[Math.floor(Math.random() * EXP_BAR_LEVEL_UP_COLORS.length)] as string;

    model.particles.push({
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
    const color = EXP_BAR_LEVEL_UP_COLORS[Math.floor(Math.random() * EXP_BAR_LEVEL_UP_COLORS.length)] as string;

    model.particles.push({
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

  if (model.particles.length > MAX_EXP_BAR_LEVEL_UP_PARTICLES) {
    model.particles.splice(0, model.particles.length - MAX_EXP_BAR_LEVEL_UP_PARTICLES);
  }
}

function updateExpBarLevelUpParticles(model: ReturnType<typeof getHudViewModel>, deltaTime: number) {
  const particles = model.particles;
  if (particles.length === 0) return;

  const deltaSeconds = deltaTime / 1000;
  let writeIndex = 0;

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    particle.elapsedMs += deltaTime;

    if (particle.elapsedMs >= particle.lifeMs) continue;

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

function renderExpBarLevelUpParticles(ctx: CanvasRenderingContext2D, model: ReturnType<typeof getHudViewModel>) {
  const particles = model.particles;
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
