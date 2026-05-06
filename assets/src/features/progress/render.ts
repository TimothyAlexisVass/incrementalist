import {
  BAR_COLLECTION_GLOW_FADE_MULTIPLIER,
  BAR_FULL_PULSE_SPEED,
  BAR_RESET_LERP_SPEED,
  PROGRESS_BAR_WIDTH,
  PROGRESS_PERCENT_FONT,
  IDLE_TOGGLE_FONT,
} from '../../config';
import { COLORS } from '../../colors';
import { drawButton } from '../../ui/components';
import { formatPercent } from '../../format';
import { drawLockedElement, lerpColor } from '../../utils';
import {
  setGpuProgressBarGlow,
  spawnGpuProgressCollectionLaserBurst,
  spawnGpuProgressCompletionBurst,
  updateGpuProgressLiquidBubbles
} from '../../render/webgl-effects';

const TWO_PI = Math.PI * 2;
const PROGRESS_VISUAL_STATE = {
  wasFull: false,
  fullStartedAt: 0,
  lastTimestamp: 0,
  completionParticles: [],
  liquidBubbles: [],
  liquidBubbleSpawnAccumulator: 0,
  usesGpuLiquidBubbles: false,
  displayedFillRatio: 0,
  collectionGlowStartedAt: 0
};
const FULL_PULSE_MAX = 1.6;
const COLLECTION_GLOW_FADE_MS = (Math.PI * 165) / (
  BAR_FULL_PULSE_SPEED * BAR_COLLECTION_GLOW_FADE_MULTIPLIER
);
const MAX_PROGRESS_COMPLETION_PARTICLES = 512;
const MAX_PROGRESS_LIQUID_BUBBLES = 58;
const LIQUID_SURFACE_WAVE_HEIGHT = 2.2;

const COMPLETION_BURST_COLORS = Object.freeze([
  COLORS.bar.progress.fillStart,
  COLORS.bar.progress.fillMid,
  COLORS.bar.progress.fillEnd,
  [255, 255, 255],
  [142, 246, 255]
]);

const COLLECTION_LASER_BURST_COLORS = Object.freeze([
  COLORS.bar.progress.fillEnd,
  [255, 255, 255],
  COLORS.bar.progress.fillMid,
  [142, 246, 255],
  COLORS.bar.progress.fillStart
]);

export function triggerProgressBarCollectionEffect(canvas = null) {
  PROGRESS_VISUAL_STATE.displayedFillRatio = 1;
  PROGRESS_VISUAL_STATE.collectionGlowStartedAt = getNowMs();

  if (!canvas) {
    return;
  }

  const {
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight
  } = getProgressBarLayout(canvas);

  spawnGpuProgressCollectionLaserBurst(
    barX,
    barY,
    barWidth,
    barHeight,
    COLLECTION_LASER_BURST_COLORS
  );
}

import { getViewModel } from "./view-model";

export function renderProgressBar(ctx, canvas) {
  if (!ctx || !canvas) return;

  const state = getViewModel();

  const {
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight
  } = getProgressBarLayout(canvas);

  const now = getNowMs();
  const deltaTime = getProgressVisualDelta(now);
  const fillValue = clampNumber(Number(state?.projectedFill) || 0, 0, 100);
  const fillRatio = fillValue / 100;
  const displayedFillRatio = updateDisplayedProgressFill(fillRatio, deltaTime);
  const displayedFillValue = displayedFillRatio * 100;
  const isFull = state.state === "confirmed_collectible";
  const collectionPulse = getCollectionGlowPulse(now);

  if (isFull && !PROGRESS_VISUAL_STATE.wasFull) {
    PROGRESS_VISUAL_STATE.fullStartedAt = now;
    spawnProgressCompletionBurst(barX, barY, barWidth, barHeight);
  }

  if (!isFull) {
    PROGRESS_VISUAL_STATE.fullStartedAt = 0;
  }

  PROGRESS_VISUAL_STATE.wasFull = isFull;
  updateProgressCompletionParticles(deltaTime);

  ctx.fillStyle = COLORS.bar.track;
  ctx.fillRect(barX, barY, barWidth, barHeight);

  const fillHeight = displayedFillRatio * barHeight;
  const fillY = barY + barHeight - fillHeight;
  PROGRESS_VISUAL_STATE.usesGpuLiquidBubbles = updateGpuProgressLiquidBubbles(deltaTime, {
    barX,
    barY,
    barWidth,
    barHeight,
    fillY,
    fillHeight,
    fillRatio: displayedFillRatio
  });

  if (PROGRESS_VISUAL_STATE.usesGpuLiquidBubbles) {
    PROGRESS_VISUAL_STATE.liquidBubbles.length = 0;
    PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator = 0;
  } else {
    updateProgressLiquidBubbles(deltaTime, barX, barY, barWidth, barHeight, displayedFillRatio, now);
  }

  const pulse = isFull ? getFullPulse(now) : 1;
  const hasCollectionGlow = collectionPulse > 0;
  const collectionGlowFade = hasCollectionGlow
    ? clampNumber(collectionPulse / FULL_PULSE_MAX, 0, 1)
    : 0;
  const glowColor = hasCollectionGlow
    ? COLORS.bar.progress.fillEnd
    : getProgressColorArray(displayedFillRatio * 100);
  const gpuGlowFillY = hasCollectionGlow ? barY : fillY;
  const gpuGlowFillHeight = hasCollectionGlow ? barHeight : fillHeight;
  const gpuFillCharge = Math.pow(displayedFillRatio, 0.85);
  const gpuBaseIntensity = isFull
    ? 0.34 + pulse * 0.14
    : gpuFillCharge * 0.08 + displayedFillRatio * 0.1;
  const gpuCollectionIntensity = hasCollectionGlow
    ? collectionGlowFade * 0.34 + collectionPulse * 0.14
    : 0;
  const gpuBaseRadius = isFull ? 26 + pulse * 6 : 14 + displayedFillRatio * 10;
  const gpuCollectionRadius = hasCollectionGlow ? 26 + FULL_PULSE_MAX * 6 : 0;
  setGpuProgressBarGlow({
    active: hasCollectionGlow ? collectionGlowFade > 0 : displayedFillRatio > 0,
    x: barX,
    y: gpuGlowFillY,
    width: barWidth,
    height: gpuGlowFillHeight,
    color: glowColor,
    radius: Math.max(gpuBaseRadius, gpuCollectionRadius),
    intensity: hasCollectionGlow ? gpuCollectionIntensity : gpuBaseIntensity
  });

  renderLiquidProgressFill(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, displayedFillRatio, now);

  renderProgressGlow(ctx, barX, barY, barWidth, barHeight, displayedFillRatio, isFull, now, collectionPulse);

  if (isFull) {
    renderRisingEnergy(ctx, barX, barY, barWidth, barHeight, now);
  }

  ctx.save();
  if (isFull) {
    const pulse = getFullPulse(now);
    ctx.shadowColor = rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0.22 * pulse);
    ctx.shadowBlur = 2 + 2 * pulse;
  }
  ctx.strokeStyle = COLORS.bar.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);
  ctx.restore();

  renderProgressCompletionParticles(ctx);

  const progressPercent = Math.floor(displayedFillValue);

  ctx.save();
  ctx.fillStyle = getProgressColor(progressPercent);
  ctx.font = PROGRESS_PERCENT_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(formatPercent(progressPercent, 0), barX + barWidth / 2, barY - 8);
  ctx.restore();

  if (isFull) {
    const pulse = getFullPulse(now);
    ctx.save();
    ctx.font = IDLE_TOGGLE_FONT;
    ctx.fillStyle = rgbaArrayToCss([255, 255, 255], 0.78 + 0.22 * pulse);
    ctx.shadowColor = rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0.22);
    ctx.shadowBlur = 2;
    ctx.textAlign = 'center';
    ctx.fillText('ACT!', barX + barWidth / 2, barY + barHeight + 16);
    ctx.restore();
  }
}

function rgbArrayToCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function rgbaArrayToCss(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clampNumber(alpha, 0, 1)})`;
}

function getProgressColorArray(percent) {
  const start = COLORS.bar.progress.fillStart;
  const mid = COLORS.bar.progress.fillMid;
  const end = COLORS.bar.progress.fillEnd;
  const clampedPercent = clampNumber(percent, 0, 100);

  let color;

  if (clampedPercent < 50) {
    const t = clampedPercent / 50;
    color = lerpColor(start, mid, t);
  } else {
    const t = (clampedPercent - 50) / 50;
    color = lerpColor(mid, end, t);
  }

  return color;
}

function getProgressColor(percent) {
  const color = getProgressColorArray(percent);
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function getProgressVisualDelta(now) {
  if (!PROGRESS_VISUAL_STATE.lastTimestamp) {
    PROGRESS_VISUAL_STATE.lastTimestamp = now;
    return 16.67;
  }

  const deltaTime = clampNumber(now - PROGRESS_VISUAL_STATE.lastTimestamp, 0, 80);
  PROGRESS_VISUAL_STATE.lastTimestamp = now;
  return deltaTime;
}

function updateDisplayedProgressFill(targetFillRatio, deltaTime) {
  const target = clampNumber(targetFillRatio, 0, 1);
  const current = clampNumber(PROGRESS_VISUAL_STATE.displayedFillRatio, 0, 1);

  if (target >= current) {
    PROGRESS_VISUAL_STATE.displayedFillRatio = target;
    return target;
  }

  const deltaSeconds = Math.max(0, deltaTime) / 1000;
  const lerpAmount = 1 - Math.exp(-BAR_RESET_LERP_SPEED * deltaSeconds);
  const next = current + (target - current) * lerpAmount;

  PROGRESS_VISUAL_STATE.displayedFillRatio = Math.abs(next - target) < 0.001
    ? target
    : next;

  return PROGRESS_VISUAL_STATE.displayedFillRatio;
}

function getFullPulse(now, speed = BAR_FULL_PULSE_SPEED) {
  const pulseSpeed = clampNumber(Number(speed) || BAR_FULL_PULSE_SPEED, 0.1, 4);
  const elapsed = Math.max(0, now - (PROGRESS_VISUAL_STATE.fullStartedAt || now));
  return 0.55 + ((Math.cos((elapsed * pulseSpeed) / 165) + 1) / 2) * 1.05;
}

function getCollectionGlowPulse(now) {
  const startedAt = PROGRESS_VISUAL_STATE.collectionGlowStartedAt;
  if (!startedAt) {
    return 0;
  }

  const progress = clampNumber((now - startedAt) / COLLECTION_GLOW_FADE_MS, 0, 1);
  if (progress >= 1) {
    PROGRESS_VISUAL_STATE.collectionGlowStartedAt = 0;
    return 0;
  }

  return FULL_PULSE_MAX * Math.cos(progress * Math.PI * 0.5);
}

function renderLiquidProgressFill(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
  if (fillHeight <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(barX, barY, barWidth, barHeight);
  ctx.clip();

  ctx.save();
  traceLiquidPath(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
  ctx.clip();

  const progressGradient = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
  progressGradient.addColorStop(0, rgbArrayToCss(COLORS.bar.progress.fillEnd));
  progressGradient.addColorStop(0.5, rgbArrayToCss(COLORS.bar.progress.fillMid));
  progressGradient.addColorStop(1, rgbArrayToCss(COLORS.bar.progress.fillStart));
  ctx.fillStyle = progressGradient;
  ctx.fillRect(barX, barY, barWidth, barHeight);

  if (!PROGRESS_VISUAL_STATE.usesGpuLiquidBubbles) {
    renderLiquidBubbles(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
  }
  ctx.restore();

  renderLiquidSurfaceHighlight(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
  ctx.restore();
}

function traceLiquidPath(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
  const bottomY = barY + barHeight;
  const step = 2;

  ctx.beginPath();
  ctx.moveTo(barX, bottomY);
  ctx.lineTo(barX + barWidth, bottomY);

  for (let x = barX + barWidth; x >= barX; x -= step) {
    ctx.lineTo(
      x,
      getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now)
    );
  }

  ctx.lineTo(
    barX,
    getLiquidSurfaceY(barX, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now)
  );
  ctx.closePath();
}

function getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
  const waveHeight = getLiquidWaveHeight(fillHeight, fillRatio, barHeight);
  if (waveHeight <= 0) {
    return clampNumber(fillY, barY, barY + barHeight);
  }

  const xRatio = (x - barX) / Math.max(1, barWidth);
  const primaryWave = Math.sin(xRatio * TWO_PI * 0.7 + now * 0.0032);
  const secondaryWave = Math.sin(xRatio * TWO_PI * 1.35 - now * 0.0024);
  const surfaceY = fillY + primaryWave * waveHeight + secondaryWave * waveHeight * 0.22;

  return clampNumber(surfaceY, barY, barY + barHeight);
}

function getLiquidWaveHeight(fillHeight, fillRatio, barHeight) {
  const topClearance = Math.max(0, (1 - fillRatio) * barHeight * 0.55);
  return Math.min(LIQUID_SURFACE_WAVE_HEIGHT, fillHeight * 0.08, topClearance);
}

function updateProgressLiquidBubbles(deltaTime, barX, barY, barWidth, barHeight, fillRatio, now) {
  const bubbles = PROGRESS_VISUAL_STATE.liquidBubbles;
  const fillHeight = fillRatio * barHeight;
  const fillY = barY + barHeight - fillHeight;

  if (fillRatio <= 0.02 || fillHeight < 8) {
    bubbles.length = 0;
    PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator = 0;
    return;
  }

  const deltaSeconds = deltaTime / 1000;
  let writeIndex = 0;

  for (let i = 0; i < bubbles.length; i += 1) {
    const bubble = bubbles[i];
    bubble.ageMs += deltaTime;
    bubble.y -= bubble.speed * deltaSeconds;

    const bubbleX = getLiquidBubbleX(bubble);
    const surfaceY = getLiquidSurfaceY(
      bubbleX,
      barX,
      barY,
      barWidth,
      barHeight,
      fillY,
      fillHeight,
      fillRatio,
      now
    );

    if (bubble.y - bubble.radius <= surfaceY || bubble.y + bubble.radius < barY) {
      continue;
    }

    bubbles[writeIndex] = bubble;
    writeIndex += 1;
  }

  bubbles.length = writeIndex;

  if (fillHeight < 20) return;

  PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator += deltaTime * (0.003 + fillRatio * 0.0044);

  while (
    PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator >= 1 &&
    bubbles.length < MAX_PROGRESS_LIQUID_BUBBLES
  ) {
    spawnProgressLiquidBubble(barX, barY, barWidth, barHeight, fillHeight, fillRatio);
    PROGRESS_VISUAL_STATE.liquidBubbleSpawnAccumulator -= 1;
  }
}

function spawnProgressLiquidBubble(barX, barY, barWidth, barHeight, fillHeight, fillRatio) {
  const radius = 0.42 + Math.random() * (0.62 + fillRatio * 0.32);
  const padding = 3 + radius;
  const availableWidth = Math.max(0, barWidth - padding * 2);
  const bottomY = barY + barHeight;

  PROGRESS_VISUAL_STATE.liquidBubbles.push({
    baseX: barX + padding + Math.random() * availableWidth,
    y: bottomY - Math.random() * Math.min(12, fillHeight * 0.22) + radius,
    radius,
    speed: 42 + Math.random() * 30,
    phase: Math.random() * TWO_PI,
    alpha: 0.28 + Math.random() * 0.3,
    ageMs: Math.random() * 600
  });
}

function getLiquidBubbleX(bubble) {
  return bubble.baseX;
}

function renderLiquidBubbles(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
  const bubbles = PROGRESS_VISUAL_STATE.liquidBubbles;
  if (bubbles.length === 0) return;

  const bottomY = barY + barHeight;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < bubbles.length; i += 1) {
    const bubble = bubbles[i];
    const x = getLiquidBubbleX(bubble);
    const surfaceY = getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
    const surfaceFade = clampNumber((bubble.y - surfaceY) / Math.max(1, bubble.radius * 7), 0, 1);
    const bottomFade = clampNumber((bottomY - bubble.y + bubble.radius * 2) / Math.max(1, bubble.radius * 8), 0, 1);
    const wobblePulse = 0.82 + Math.sin((bubble.ageMs / 1000) * 2.2 + bubble.phase) * 0.08;
    const alpha = bubble.alpha * Math.min(surfaceFade, bottomFade) * wobblePulse;

    if (alpha <= 0.01) continue;

    ctx.fillStyle = rgbaArrayToCss([255, 255, 255], alpha * 0.12);
    ctx.strokeStyle = rgbaArrayToCss([255, 255, 255], alpha);
    ctx.lineWidth = 0.55;
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(x, bubble.y, bubble.radius, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgbaArrayToCss([255, 255, 255], alpha * 0.85);
    ctx.beginPath();
    ctx.arc(x - bubble.radius * 0.32, bubble.y - bubble.radius * 0.35, Math.max(0.18, bubble.radius * 0.18), 0, TWO_PI);
    ctx.fill();
  }

  ctx.restore();
}

function renderLiquidSurfaceHighlight(ctx, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now) {
  const waveHeight = getLiquidWaveHeight(fillHeight, fillRatio, barHeight);
  const surfaceGlow = clampNumber(0.22 + fillRatio * 0.34, 0, 0.5);
  const step = 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(barX, barY, barWidth, barHeight);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  ctx.beginPath();
  for (let x = barX; x <= barX + barWidth; x += step) {
    const y = getLiquidSurfaceY(x, barX, barY, barWidth, barHeight, fillY, fillHeight, fillRatio, now);
    if (x === barX) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.strokeStyle = rgbaArrayToCss([255, 255, 255], surfaceGlow);
  ctx.lineWidth = 1.5;
  ctx.shadowColor = rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0.18);
  ctx.shadowBlur = 1 + waveHeight * 0.4;
  ctx.stroke();
  ctx.restore();
}

function renderProgressGlow(ctx, barX, barY, barWidth, barHeight, fillRatio, isFull, now, collectionPulse = 0) {
  if (fillRatio <= 0 && collectionPulse <= 0) return;

  const hasCollectionGlow = collectionPulse > 0;
  const collectionFade = hasCollectionGlow
    ? clampNumber(collectionPulse / FULL_PULSE_MAX, 0, 1)
    : 0;
  const glowColor = collectionPulse > 0
    ? COLORS.bar.progress.fillEnd
    : getProgressColorArray(fillRatio * 100);
  const charge = Math.pow(fillRatio, 0.85);
  const pulse = isFull ? getFullPulse(now) : 1;
  const baseGlowPower = charge * pulse;
  const glowPower = hasCollectionGlow ? collectionPulse : baseGlowPower;
  const strokeBaseFade = hasCollectionGlow ? collectionFade : charge;
  const shadowAlpha = 0.8 * glowPower;
  const strokeAlpha = 0.12 * strokeBaseFade + 0.5 * glowPower;

  if (shadowAlpha <= 0.001 && strokeAlpha <= 0.001) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowColor = rgbaArrayToCss(glowColor, shadowAlpha);
  ctx.shadowBlur = 10 + 46 * glowPower;
  ctx.strokeStyle = rgbaArrayToCss(glowColor, strokeAlpha);
  ctx.lineWidth = 1 + 6 * glowPower;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barWidth - 1, barHeight - 1);

  if (isFull) {
    ctx.shadowColor = rgbaArrayToCss([255, 255, 255], 0.5 * pulse);
    ctx.shadowBlur = 38 + 36 * pulse;
    ctx.strokeStyle = rgbaArrayToCss([255, 255, 255], 0.16 + 0.32 * pulse);
    ctx.lineWidth = 2 + 3 * pulse;
    ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
  }

  ctx.restore();
}

function renderRisingEnergy(ctx, barX, barY, barWidth, barHeight, now) {
  const innerX = barX + 4;
  const innerY = barY + 3;
  const innerWidth = barWidth - 8;
  const innerHeight = barHeight - 6;
  const pulse = getFullPulse(now);

  if (innerWidth <= 0 || innerHeight <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerWidth, innerHeight);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < 3; i += 1) {
    const phase = ((now * 0.00022) + i / 3) % 1;
    const y = innerY + innerHeight - phase * innerHeight;
    const alpha = Math.sin(phase * Math.PI) * 0.2 * pulse;
    const bandGradient = ctx.createLinearGradient(innerX, y, innerX + innerWidth, y);

    bandGradient.addColorStop(0, rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0));
    bandGradient.addColorStop(0.5, rgbaArrayToCss([255, 255, 255], alpha));
    bandGradient.addColorStop(1, rgbaArrayToCss(COLORS.bar.progress.fillEnd, 0));

    ctx.fillStyle = bandGradient;
    ctx.fillRect(innerX, y, innerWidth, 2);
  }

  ctx.restore();
}

function spawnProgressCompletionBurst(barX, barY, barWidth, barHeight) {
  if (spawnGpuProgressCompletionBurst(
    barX,
    barY,
    barWidth,
    barHeight,
    COMPLETION_BURST_COLORS,
    { countMultiplier: 1.5, gravity: 100 }
  )) {
    return;
  }

  const centerX = barX + barWidth / 2;
  const centerY = barY + barHeight / 2;

  for (let i = 0; i < 81; i += 1) {
    const originX = barX + Math.random() * barWidth;
    const originY = barY + Math.random() * barHeight;
    const outwardAngle = Math.atan2(originY - centerY, originX - centerX);
    const angle = outwardAngle + (Math.random() - 0.5) * 0.95;
    const speed = 90 + Math.random() * 250;
    const color = COMPLETION_BURST_COLORS[Math.floor(Math.random() * COMPLETION_BURST_COLORS.length)];
    const colorCss = rgbArrayToCss(color);

    PROGRESS_VISUAL_STATE.completionParticles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.94 + Math.random() * 0.03,
      radius: 1.4 + Math.random() * 3.2,
      lineWidth: 1.1 + Math.random() * 1.5,
      colorCss,
      elapsedMs: 0,
      lifeMs: 560 + Math.random() * 520
    });
  }

  for (let i = 0; i < 27; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const speed = 150 + Math.random() * 260;
    const color = COMPLETION_BURST_COLORS[Math.floor(Math.random() * COMPLETION_BURST_COLORS.length)];
    const colorCss = rgbArrayToCss(color);

    PROGRESS_VISUAL_STATE.completionParticles.push({
      x: barX + Math.random() * barWidth,
      y: barY + Math.random() * 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drag: 0.93 + Math.random() * 0.03,
      radius: 1.2 + Math.random() * 2.4,
      lineWidth: 1 + Math.random() * 1.3,
      colorCss,
      elapsedMs: 0,
      lifeMs: 520 + Math.random() * 480
    });
  }

  if (PROGRESS_VISUAL_STATE.completionParticles.length > MAX_PROGRESS_COMPLETION_PARTICLES) {
    PROGRESS_VISUAL_STATE.completionParticles.splice(
      0,
      PROGRESS_VISUAL_STATE.completionParticles.length - MAX_PROGRESS_COMPLETION_PARTICLES
    );
  }
}

function updateProgressCompletionParticles(deltaTime) {
  const particles = PROGRESS_VISUAL_STATE.completionParticles;
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
    particle.vy *= drag;
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particles[writeIndex] = particle;
    writeIndex += 1;
  }

  particles.length = writeIndex;
}

function renderProgressCompletionParticles(ctx) {
  const particles = PROGRESS_VISUAL_STATE.completionParticles;
  if (particles.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  for (let i = 0; i < particles.length; i += 1) {
    const particle = particles[i];
    const lifeProgress = particle.elapsedMs / particle.lifeMs;
    const alpha = Math.pow(Math.max(0, 1 - lifeProgress), 1.45);
    const tailScale = 0.018 + (1 - lifeProgress) * 0.034;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = particle.colorCss;
    ctx.fillStyle = particle.colorCss;
    ctx.shadowColor = particle.colorCss;
    ctx.shadowBlur = 14 * alpha;
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

export function getProgressBarLayout(canvas) {
  const baseHeight = canvas.height - 120;
  const barHeight = baseHeight * 0.72;

  return {
    x: canvas.width - 92,
    y: 90,
    width: PROGRESS_BAR_WIDTH,
    height: barHeight
  };
}

export function getIdleModeToggleRect(canvas) {
  const barLayout = getProgressBarLayout(canvas);
  return {
    x: barLayout.x + barLayout.width / 2 - 30,
    y: barLayout.y + barLayout.height + 25,
    width: 60,
    height: 20
  };
}

export function renderIdleModeToggle(ctx, canvas, state) {
  const toggleRect = getIdleModeToggleRect(canvas);
  const drawToggle = () => drawButton(ctx, toggleRect, state.idleMode ? 'IDLE' : 'ACTIVE', {
    active: false,
    activeSurface: state.idleMode ? COLORS.button.toggle.off : COLORS.button.toggle.on,
    inactiveSurface: state.idleMode ? COLORS.button.toggle.off : COLORS.button.toggle.on,
    activeBorder: COLORS.button.border.inactive,
    inactiveBorder: COLORS.button.border.inactive,
    textColor: COLORS.button.text,
    font: IDLE_TOGGLE_FONT,
    textY: toggleRect.y + 14
  });

  if (!state.features?.idleModePurchased) {
    drawLockedElement(ctx, toggleRect, drawToggle, { font: IDLE_TOGGLE_FONT });
    return null;
  }

  drawToggle();
  return toggleRect;
}
