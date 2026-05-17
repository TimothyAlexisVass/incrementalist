import {
  BAR_COLLECTION_GLOW_FADE_MULTIPLIER,
  BAR_FULL_PULSE_SPEED,
  BAR_RESET_LERP_SPEED,
  PROGRESS_BAR_WIDTH,
  IDLE_TOGGLE_FONT,
  TINY_TEXT_FONT,
  TOP_HUD_HEIGHT,
  BOTTOM_HUD_HEIGHT,
} from '../../config';
import { COLORS } from '../../colors';
import { drawButton } from '../../ui/components/button';
import { clampNumber, lerpColor, rgbArrayToCss, rgbaArrayToCss } from '../../utils';
import { hexToRgba } from '../../utils/color';
import { drawLockedElement } from '../../ui/components/locked-element';
import { notices } from '../../ui/managers/notices';
import { pointInRect } from '../../ui/managers/interactions';
import { SHOP_UNLOCK_REQUIRED_LEVELS, formatUnlockRequirement } from "../requirements";
import {
  updateGpuProgressLiquidBubbles,
  spawnGpuProgressCollectionLaserBurst,
  spawnGpuProgressCompletionBurst,
  releaseSisuParticles,
  ColorInput
} from '../../render/webgl-effects';
import { getViewModel } from './view-model';
import { syncSisuVisualTier } from '../sisu/view-model';
import { InteractionState } from '../../ui/managers/interactions';
import { getServerNow } from '../../core/time';
import { getActiveWebGLRenderer } from '../../renderer/webgl';
import { queueTooltip } from '../../ui/components/tooltip';

type Rgb = [number, number, number];
// Types for visual state tracking

const TWO_PI = Math.PI * 2;
const PROGRESS_VISUAL_STATE: {
  wasFull: boolean;
  fullStartedAt: number;
  lastTimestamp: number;
  displayedFillRatio: number;
  collectionGlowStartedAt: number;
} = {
  wasFull: false,
  fullStartedAt: 0,
  lastTimestamp: 0,
  displayedFillRatio: 0,
  collectionGlowStartedAt: 0
};
const FULL_PULSE_MAX = 1.6;
const COLLECTION_GLOW_FADE_MS = (Math.PI * 165) / (
  BAR_FULL_PULSE_SPEED * BAR_COLLECTION_GLOW_FADE_MULTIPLIER
);

const YELLOW_GLOW: Rgb = [255, 255, 0];
const IDLE_GLOW: Rgb = [160, 100, 255];

const COMPLETION_BURST_COLORS: readonly ColorInput[] = Object.freeze([
  COLORS.bar.progress.fillStart,
  COLORS.bar.progress.fillMid,
  COLORS.bar.progress.fillEnd,
  [255, 255, 255] as const,
  [142, 246, 255] as const
]);

const COLLECTION_LASER_BURST_COLORS: readonly ColorInput[] = Object.freeze([
  COLORS.bar.progress.fillEnd,
  [255, 255, 255] as const,
  COLORS.bar.progress.fillMid,
  [142, 246, 255] as const,
  COLORS.bar.progress.fillStart
]);
const PROGRESS_TOOLTIP_TEXT_KEY = "progress.bar.hover";
export function triggerProgressBarCollectionEffect(canvas: HTMLCanvasElement | null = null, sisuTier: string | null = null) {
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

  const vm = getViewModel();
  const palette = getProgressPalette(vm.idleMode);

  spawnGpuProgressCollectionLaserBurst(
    barX,
    barY,
    barWidth,
    barHeight,
    palette.fillStart,
    palette.fillEnd
  );

  releaseSisuParticles();
  
  if (sisuTier) {
    syncSisuVisualTier(sisuTier as any);
  }
}

let progressBarBackgroundImage: HTMLImageElement | null = null;
function getProgressBarBackgroundImage() {
  if (!progressBarBackgroundImage) {
    progressBarBackgroundImage = new Image();
    progressBarBackgroundImage.src = 'images/progress_bar_background.png';
  }
  return progressBarBackgroundImage;
}

let progressBarForegroundImage: HTMLImageElement | null = null;
function getProgressBarForegroundImage() {
  if (!progressBarForegroundImage) {
    progressBarForegroundImage = new Image();
    progressBarForegroundImage.src = 'images/progress_bar_foreground.png';
  }
  return progressBarForegroundImage;
}

export function renderProgressBar(
  canvas: HTMLCanvasElement | null,
  input: InteractionState,
  blocked: boolean = false
) {
  if (!canvas) return;
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const bgWidth = 160;
  const bgX = canvas.width - bgWidth;

  const bgImage = getProgressBarBackgroundImage();
  if (bgImage.complete && bgImage.naturalWidth > 0) {
    renderer.drawImage({
      image: bgImage,
      x: bgX,
      y: TOP_HUD_HEIGHT,
      width: bgWidth,
      height: canvas.height - TOP_HUD_HEIGHT - BOTTOM_HUD_HEIGHT
    });
  } else {
    renderer.drawRect({
      x: bgX,
      y: 0,
      width: bgWidth,
      height: canvas.height,
      color: hexToRgba(COLORS.panel.bg)
    });
  }

  renderProgressBarDirect(renderer, canvas, input, blocked);
}

export function renderProgressBarForeground(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const bgWidth = 160;
  const bgX = canvas.width - bgWidth;
  const fgImage = getProgressBarForegroundImage();

  if (fgImage.complete && fgImage.naturalWidth > 0) {
    renderer.drawImage({
      image: fgImage,
      x: bgX,
      y: TOP_HUD_HEIGHT,
      width: bgWidth,
      height: canvas.height - TOP_HUD_HEIGHT - BOTTOM_HUD_HEIGHT
    });
  }
}

import { WebGLRenderer } from '../../renderer/webgl';

function renderProgressBarDirect(
  renderer: WebGLRenderer,
  canvas: HTMLCanvasElement,
  input: InteractionState,
  blocked: boolean = false
) {
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
  const idleMode = state.idleMode;
  const progressPalette = getProgressPalette(idleMode);
  const displayedFillRatio = updateDisplayedProgressFill(fillRatio, deltaTime);
  const isFull = state?.state === "confirmed_collectible" || (state?.projectedFill >= 100);
  const collectionPulse = getCollectionGlowPulse(now);

  if (isFull && !PROGRESS_VISUAL_STATE.wasFull) {
    PROGRESS_VISUAL_STATE.fullStartedAt = now;
    spawnGpuProgressCompletionBurst(
      barX,
      barY,
      barWidth,
      barHeight,
      COMPLETION_BURST_COLORS,
      { countMultiplier: 1.5, gravity: 100 }
    );
  }

  PROGRESS_VISUAL_STATE.wasFull = isFull;

  // Draw track
  renderer.drawRect({
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight,
    color: hexToRgba(COLORS.bar.track)
  });

  // Track Depth (Inner Shadow)
  renderer.drawGlowRect({
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight,
    color: [0, 0, 0, 1],
    radius: 12,
    intensity: 0.25,
    innerAlpha: 1.0,
    outerAlpha: 0.0
  });

  const fillHeight = displayedFillRatio * barHeight;
  const fillY = barY + barHeight - fillHeight;

  updateGpuProgressLiquidBubbles(deltaTime, {
    barX,
    barY,
    barWidth,
    barHeight,
    fillHeight,
    fillRatio: displayedFillRatio,
    fillY
  });

  const pulse = isFull ? getFullPulse(now) : 1;
  const hasCollectionGlow = collectionPulse > 0;
  const collectionGlowFade = hasCollectionGlow
    ? clampNumber(collectionPulse / FULL_PULSE_MAX, 0, 1)
    : 0;
  const glowColor = idleMode ? IDLE_GLOW : YELLOW_GLOW;
  const gpuFillCharge = Math.pow(displayedFillRatio, 0.85);

  // Liquid Fill
  if (displayedFillRatio > 0) {
    renderer.drawLiquidRect({
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      progress: displayedFillRatio,
      time: now,
      colorStart: progressPalette.fillStart as [number, number, number],
      colorMid: progressPalette.fillMid as [number, number, number],
      colorEnd: progressPalette.fillEnd as [number, number, number],
      alpha: 1.0
    });
  }

  // Rising Energy (when full)
  if (isFull) {
    const energyPulse = getFullPulse(now);
    for (let i = 0; i < 3; i += 1) {
      const phase = ((now * 0.00022) + i / 3) % 1;
      const energyY = barY + barHeight - phase * barHeight;
      // Fade out at edges of the bar
      const edgeAlpha = Math.sin(phase * Math.PI);
      const alpha = edgeAlpha * 1.82 * energyPulse;

      renderer.drawGlowRect({
        x: barX + 6,
        y: energyY,
        width: barWidth - 12,
        height: 2,
        color: [255, 255, 255, 0.9],
        radius: 0.5,
        intensity: alpha,
        innerAlpha: 0.3,
        outerAlpha: 0.4,
        blendMode: "additive"
      });
    }
  }

  // Border glow
  const glowAlpha = (
    isFull ?
      0.34 + 0.22 * pulse :
      0.18 + gpuFillCharge * 1.5
  ) * 0.4;
  renderer.drawGlowRect({
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight,
    color: [...glowColor, 1],
    radius: isFull ? 22 + 10 * pulse : 12 + gpuFillCharge * 8,
    intensity: glowAlpha,
    innerAlpha: 0.0,
    outerAlpha: 1.0,
    blendMode: "additive"
  });

  if (isFull) {
    // Extra white pulsing glow for completion state (reduced to 40% intensity)
    renderer.drawGlowRect({
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      color: [255, 255, 255, 1],
      radius: 32 + 28 * pulse,
      intensity: (0.12 + 0.24 * pulse) * 0.4,
      innerAlpha: 0.0,
      outerAlpha: 1.0,
      blendMode: "additive"
    });
  }

  // Border
  const borderColor = hexToRgba(progressPalette.border);
  const bw = 2;
  renderer.drawRect({ x: barX, y: barY, width: barWidth, height: bw, color: borderColor }); // top
  renderer.drawRect({ x: barX, y: barY + barHeight - bw, width: barWidth, height: bw, color: borderColor }); // bottom
  renderer.drawRect({ x: barX, y: barY, width: bw, height: barHeight, color: borderColor }); // left
  renderer.drawRect({ x: barX + barWidth - bw, y: barY, width: bw, height: barHeight, color: borderColor }); // right

  const tooltipHoverRect = {
    x: barX - 12,
    y: barY,
    width: barWidth + 24,
    height: barHeight
  };
  if (!blocked && input.pointer && pointInRect(input.pointer, tooltipHoverRect)) {
    queueTooltip(input.pointer, `Progress: ${fillValue.toFixed(0)}%\nTime left: ${getProgressTimeLeftSeconds(state).toFixed(1)}`, {
      font: TINY_TEXT_FONT,
      textColor: '#f4f7ff',
      widthMode: 'estimated',
      estimatedWidthFactor: 0.46,
      textUpdateKey: PROGRESS_TOOLTIP_TEXT_KEY
    });
  }

  // Draw the foreground frame/glass BEFORE the UI elements so they stay on top.
  renderProgressBarForeground(canvas);

  renderIdleModeToggle(canvas, input, {
    idleMode: state.idleMode,
    level: state.level,
    features: {
      idleModePurchased: state.idleModePurchased
    },
    idleModeRequiredLevel: state.idleModeRequiredLevel
  }, blocked);
}

function getProgressTimeLeftSeconds(state: ReturnType<typeof getViewModel>): number {
  const now = getServerNow();
  if (state.state === "confirmed_collectible") return 0;

  if (typeof state.canClaimInMs === "number") {
    return Math.max(0, state.canClaimInMs) / 1000;
  }

  if (state.state === "awaiting_server_confirmation" && state.nextVerifyAtMs > 0) {
    return Math.max(0, state.nextVerifyAtMs - now) / 1000;
  }

  if (state.canClaimAt) {
    return Math.max(0, Date.parse(state.canClaimAt) - now) / 1000;
  }

  return 0;
}



function getProgressPalette(idleMode: boolean) {
  return idleMode ? COLORS.bar.progress.idle : COLORS.bar.progress;
}

function getProgressColorArray(percent: number, idleMode = false): Rgb {
  const palette = getProgressPalette(idleMode);
  const start = palette.fillStart;
  const mid = palette.fillMid;
  const end = palette.fillEnd;
  const clampedPercent = clampNumber(percent, 0, 100);

  let color: Rgb;

  if (clampedPercent < 50) {
    const t = clampedPercent / 50;
    color = lerpColor(start, mid, t) as Rgb;
  } else {
    const t = (clampedPercent - 50) / 50;
    color = lerpColor(mid, end, t) as Rgb;
  }

  return color;
}

function getProgressColor(percent: number, idleMode = false): string {
  const color = getProgressColorArray(percent, idleMode);
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}



function getNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function getProgressVisualDelta(now: number): number {
  if (!PROGRESS_VISUAL_STATE.lastTimestamp) {
    PROGRESS_VISUAL_STATE.lastTimestamp = now;
    return 16.67;
  }

  const deltaTime = clampNumber(now - PROGRESS_VISUAL_STATE.lastTimestamp, 0, 80);
  PROGRESS_VISUAL_STATE.lastTimestamp = now;
  return deltaTime;
}

function updateDisplayedProgressFill(targetFillRatio: number, deltaTime: number): number {
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

function getFullPulse(now: number, speed = BAR_FULL_PULSE_SPEED): number {
  const pulseSpeed = clampNumber(Number(speed) || BAR_FULL_PULSE_SPEED, 0.1, 4);
  const elapsed = Math.max(0, now - (PROGRESS_VISUAL_STATE.fullStartedAt || now));
  return 0.55 + ((Math.cos((elapsed * pulseSpeed) / 165) + 1) / 2) * 1.05;
}

function getCollectionGlowPulse(now: number): number {
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


export function getProgressBarLayout(canvas: HTMLCanvasElement) {
  const baseHeight = canvas.height - 120;
  const barHeight = 418;

  return {
    x: canvas.width - 100,
    y: 120,
    width: PROGRESS_BAR_WIDTH,
    height: barHeight
  };
}

export function getIdleModeToggleRect(canvas: HTMLCanvasElement) {
  const barLayout = getProgressBarLayout(canvas);
  return {
    x: barLayout.x + barLayout.width / 2 - 32,
    y: barLayout.y + barLayout.height + 40,
    width: 66,
    height: 20
  };
}

export function renderIdleModeToggle(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: { idleMode: boolean; level?: number; features?: { idleModePurchased?: boolean }; idleModeRequiredLevel?: number },
  blocked: boolean = false
) {
  const toggleRect = getIdleModeToggleRect(canvas);
  const drawToggle = () => drawButton(toggleRect, state.idleMode ? 'IDLE' : 'ACTIVE', {
    active: false,
    activeSurface: state.idleMode ? COLORS.button.toggle.off : COLORS.button.toggle.on,
    inactiveSurface: state.idleMode ? COLORS.button.toggle.off : COLORS.button.toggle.on,
    activeBorder: COLORS.button.border.inactive,
    inactiveBorder: COLORS.button.border.inactive,
    borderWidth: 1,
    textColor: COLORS.button.text,
    font: IDLE_TOGGLE_FONT
  });

  if (!state.features?.idleModePurchased) {
    const requiredLevel = state.idleModeRequiredLevel ?? SHOP_UNLOCK_REQUIRED_LEVELS.idle_mode;

    drawLockedElement(canvas, blocked ? { ...input, pointer: null, clicked: false } : input, toggleRect, drawToggle, {
      criteria: formatUnlockRequirement(requiredLevel, state.level),
      showNotice: notices.hasLeafNotice("leaf.feature.idle_mode.locked_text"),
      showNoticePing: true,
      padding: 3
    });
    return null;
  }

  drawToggle();
  return toggleRect;
}
