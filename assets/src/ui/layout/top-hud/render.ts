import { COLORS } from "../../../colors";
import {
  TOP_HUD_EXP_BAR_X, TOP_HUD_EXP_BAR_Y, TOP_HUD_EXP_BAR_WIDTH, TOP_HUD_EXP_BAR_HEIGHT,
  TOP_HUD_LEVEL_X, TOP_HUD_EXP_COUNTER_X, TOP_HUD_EXP_COUNTER_Y,
  TOP_HUD_CURRENCY_ICON_SIZE,
  TOP_HUD_COIN_COUNTER_Y, TOP_HUD_COINS_COUNTER_RIGHT, TOP_HUD_SHARDS_COUNTER_RIGHT, TOP_HUD_CORES_COUNTER_RIGHT,
  TOP_HUD_LEVEL_FONT, TOP_HUD_EXP_FONT, TOP_HUD_COINS_FONT
} from "../../../config";
import { formatNumber, formatNumberRatio } from "../../../utils";
import { BigNum, toNumber } from "../../../core/bignum";
import { getRequiredExp } from "./progression";
import { getHudViewModel, getAndClearQueuedLevelUps } from "./view-model";
import { drawCurrencyAmount } from "../../../render/currency-icons";
import { spawnGpuProgressCompletionBurst } from "../../../render/webgl-effects";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { resolveUpdatingText } from "../../../utils/text";

const MAX_EXP_BAR_LEVEL_UP_PARTICLES = 228;
const EXP_BAR_LEVEL_UP_PARTICLE_GRAVITY = 520;
const EXP_BAR_LEVEL_UP_PARTICLE_LIFE_MULTIPLIER = 2;
const EXP_BAR_LEVEL_UP_COLORS = Object.freeze([
  COLORS.bar.exp.fillStart,
  COLORS.bar.exp.fillEnd,
  '#ffffff',
  COLORS.rewards.expGain
]);
const TOP_HUD_EXP_TEXT_KEY = "top_hud.exp";
const TOP_HUD_LEVEL_TEXT_KEY = "top_hud.level";

export function renderTopHUD(canvas: HTMLCanvasElement, dtMs: number) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;
  const model = getHudViewModel();

  const queued = getAndClearQueuedLevelUps();
  if (queued > 0) {
    spawnExpBarLevelUpBurst(model);
  }

  updateExpBarLevelUpParticles(model, dtMs);

  renderer.drawRect({
    x: 0,
    y: 0,
    width: canvas.width,
    height: TOP_HUD_EXP_BAR_Y + TOP_HUD_EXP_BAR_HEIGHT + 16,
    color: cssToRgba(COLORS.panel.bg)
  });

  renderer.drawRect({
    x: TOP_HUD_EXP_BAR_X,
    y: TOP_HUD_EXP_BAR_Y,
    width: TOP_HUD_EXP_BAR_WIDTH,
    height: TOP_HUD_EXP_BAR_HEIGHT,
    color: cssToRgba(COLORS.bar.track)
  });

  const requiredExp = getRequiredExp(model.displayedLevel);
  const fillRatio = Math.min(1, Math.max(0, toNumber(model.displayedExp) / toNumber(requiredExp)));

  renderer.drawRect({
    x: TOP_HUD_EXP_BAR_X,
    y: TOP_HUD_EXP_BAR_Y,
    width: TOP_HUD_EXP_BAR_WIDTH * fillRatio,
    height: TOP_HUD_EXP_BAR_HEIGHT,
    color: cssToRgba(COLORS.bar.exp.fillStart)
  });
  renderer.drawRect({ x: TOP_HUD_EXP_BAR_X, y: TOP_HUD_EXP_BAR_Y, width: TOP_HUD_EXP_BAR_WIDTH, height: 2, color: cssToRgba(COLORS.bar.border) });
  renderer.drawRect({ x: TOP_HUD_EXP_BAR_X, y: TOP_HUD_EXP_BAR_Y + TOP_HUD_EXP_BAR_HEIGHT - 2, width: TOP_HUD_EXP_BAR_WIDTH, height: 2, color: cssToRgba(COLORS.bar.border) });
  renderer.drawRect({ x: TOP_HUD_EXP_BAR_X, y: TOP_HUD_EXP_BAR_Y, width: 2, height: TOP_HUD_EXP_BAR_HEIGHT, color: cssToRgba(COLORS.bar.border) });
  renderer.drawRect({ x: TOP_HUD_EXP_BAR_X + TOP_HUD_EXP_BAR_WIDTH - 2, y: TOP_HUD_EXP_BAR_Y, width: 2, height: TOP_HUD_EXP_BAR_HEIGHT, color: cssToRgba(COLORS.bar.border) });

  const expText = resolveUpdatingText(
    TOP_HUD_EXP_TEXT_KEY,
    `${formatNumberRatio(model.displayedExp, requiredExp)} EXP`,
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_EXP_FONT,
      color: COLORS.panel.textPrimary,
      align: 'center',
      baseline: 'alphabetic'
    })
  );
  renderer.drawText({
    text: expText,
    x: TOP_HUD_EXP_COUNTER_X,
    y: TOP_HUD_EXP_COUNTER_Y,
    font: TOP_HUD_EXP_FONT,
    color: COLORS.panel.textPrimary,
    align: 'center',
    baseline: 'alphabetic'
  });
  const levelText = resolveUpdatingText(
    TOP_HUD_LEVEL_TEXT_KEY,
    String(model.displayedLevel),
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_LEVEL_FONT,
      color: COLORS.panel.textPrimary,
      align: 'left',
      baseline: 'alphabetic'
    })
  );
  renderer.drawText({
    text: levelText,
    x: TOP_HUD_LEVEL_X,
    y: 34,
    font: TOP_HUD_LEVEL_FONT,
    color: COLORS.panel.textPrimary,
    align: 'left',
    baseline: 'alphabetic'
  });
  renderHudCurrencies(canvas);
}

function renderHudCurrencies(canvas: HTMLCanvasElement) {
  const model = getHudViewModel();
  drawCurrency(canvas, "Coins", model.displayedCoins, COLORS.panel.coins, TOP_HUD_COINS_COUNTER_RIGHT);
  drawCurrency(canvas, "Shards", model.displayedShards, COLORS.panel.shards, TOP_HUD_SHARDS_COUNTER_RIGHT);
  drawCurrency(canvas, "Cores", model.displayedCores, COLORS.panel.cores, TOP_HUD_CORES_COUNTER_RIGHT);
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || '').trim().replace(/^#/, '');
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}

function drawCurrency(canvas: HTMLCanvasElement, label: string, amount: BigNum, color: string, counterRight: number) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;
  const stableAmountText = resolveUpdatingText(
    `top_hud.currency.${label.toLowerCase()}`,
    formatNumber(amount),
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_COINS_FONT,
      color,
      align: 'left',
      baseline: 'alphabetic',
      strokeColor: color,
      strokeWidth: 0.6
    })
  );
  drawCurrencyAmount(
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
      iconPosition: 'right',
      formatter: () => stableAmountText
    }
  );
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
