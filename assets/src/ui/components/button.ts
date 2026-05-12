import { COLORS } from '../../colors';
import { BUTTON_DEFAULT_FONT } from '../../config';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export interface ButtonOptions {
  active?: boolean;
  activeSurface?: string;
  inactiveSurface?: string;
  activeBorder?: string;
  inactiveBorder?: string;
  textColor?: string;
  lineWidth?: number;
  font?: string;
  textAlign?: CanvasTextAlign;
  textX?: number;
  textY?: number;
  padding?: number;
  showNotice?: boolean;
  showNoticePing?: boolean;
}

const TWO_PI = Math.PI * 2;
const NOTICE_PING_INTERVAL_MS = 10_000;
const NOTICE_PING_DURATION_MS = 1_000;
const NOTICE_PING_MAX_RADIUS_PX = 100;
const NOTICE_PING_COLOR = '#00ff00';
const BUTTON_PADDING_PX = 3;
const ZERO_ALPHA_RGBA: readonly [number, number, number, number] = [0, 0, 0, 0];

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function getNoticePingProgress(x: number, y: number, radius: number) {
  const phaseOffset = Math.abs(Math.round((x * 31) + (y * 17) + (radius * 13))) % NOTICE_PING_INTERVAL_MS;
  const elapsed = (getNowMs() + phaseOffset) % NOTICE_PING_INTERVAL_MS;

  if (elapsed >= NOTICE_PING_DURATION_MS) {
    return 0;
  }

  return elapsed / NOTICE_PING_DURATION_MS;
}

function drawNoticePing(x: number, y: number, radius: number) {
  const renderer = getActiveWebGLRenderer();

  const progress = getNoticePingProgress(x, y, radius);

  if (progress <= 0) {
    return;
  }

  const ringRadius = Math.max(radius, progress * NOTICE_PING_MAX_RADIUS_PX);
  const fade = Math.pow(1 - progress, 1.5);
  const ringRect = {
    x: x - ringRadius,
    y: y - ringRadius,
    width: ringRadius * 2,
    height: ringRadius * 2
  };

  drawRectOutline(renderer, ringRect, 7, [0, 1, 0, 0.22 * fade]);
  drawRectOutline(renderer, ringRect, 2, [0, 1, 0, 0.75 * fade]);
}

export function drawButton(
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  options: ButtonOptions = {}
) {
  const renderer = getActiveWebGLRenderer();
  if (!rect) {
    return;
  }

  const {
    active = false,
    activeSurface = COLORS.button.surface.active,
    inactiveSurface = COLORS.button.surface.inactive,
    activeBorder = COLORS.button.border.active,
    inactiveBorder = COLORS.button.border.inactive,
    textColor = COLORS.button.text,
    lineWidth = 2,
    font = BUTTON_DEFAULT_FONT,
    textAlign = 'center',
    textX = rect.x + (rect.width / 2),
    textY = rect.y + (rect.height / 2),
    padding = BUTTON_PADDING_PX
  } = options;

  const paddedRect = {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + (padding * 2),
    height: rect.height + (padding * 2)
  };

  renderer.drawRect({
    x: paddedRect.x,
    y: paddedRect.y,
    width: paddedRect.width,
    height: paddedRect.height,
    color: cssToRgba(active ? activeSurface : inactiveSurface)
  });
  drawRectOutline(renderer, paddedRect, lineWidth, cssToRgba(active ? activeBorder : inactiveBorder));
  renderer.drawText({
    text: label,
    x: textX,
    y: textY,
    font,
    color: textColor,
    align: textAlign,
    baseline: 'middle'
  });

  if (options.showNotice) {
    drawNoticeDot(rect.x + rect.width + 2, rect.y - 2, 4, options.showNoticePing ?? false);
  }
}

export function drawNoticeDot(
  x: number,
  y: number,
  radius: number = 4,
  animated: boolean = true
) {
  const renderer = getActiveWebGLRenderer();

  if (animated) {
    drawNoticePing(x, y, radius);
  }

  const dotRect = {
    x: x - radius,
    y: y - radius,
    width: radius * 2,
    height: radius * 2
  };
  renderer.drawRect({
    x: dotRect.x,
    y: dotRect.y,
    width: dotRect.width,
    height: dotRect.height,
    color: cssToRgba(NOTICE_PING_COLOR)
  });
  drawRectOutline(renderer, dotRect, 1, cssToRgba(NOTICE_PING_COLOR, 0.95));
  const glowPad = Math.max(1, Math.round(radius * 0.8));
  renderer.drawRect({
    x: dotRect.x - glowPad,
    y: dotRect.y - glowPad,
    width: dotRect.width + glowPad * 2,
    height: dotRect.height + glowPad * 2,
    color: cssToRgba(NOTICE_PING_COLOR, 0.12)
  });
}

import { InteractionState, pointInRect } from '../managers/interactions';

export function doButton(
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  options: ButtonOptions = {}
): boolean {
  const padding = options.padding ?? BUTTON_PADDING_PX;
  const hitRect = {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + (padding * 2),
    height: rect.height + (padding * 2)
  };

  const isHovered = pointInRect(input.pointer, hitRect);
  const startedInside = pointInRect(input.pressStartPointer, hitRect);
  let clicked = false;

  if (isHovered && startedInside && input.clicked && !input.consumed) {
    clicked = true;
    input.consumed = true; // Block clicks falling through to game world
  }

  // Visual "active" state:
  // 1. If currently pressing, only show active if started inside and still hovering
  // 2. If not pressing, show active if hovering
  const isDown = input.isPressed;
  options.active = isDown ? (startedInside && isHovered) : isHovered;

  drawButton(rect, label, options);

  return clicked;
}

function drawRectOutline(
  renderer: ReturnType<typeof getActiveWebGLRenderer>,
  rect: { x: number; y: number; width: number; height: number },
  lineWidth: number,
  color: readonly [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(lineWidth) ? lineWidth : 1);
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: stroke, color });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - stroke, width: rect.width, height: stroke, color });
  renderer.drawRect({ x: rect.x, y: rect.y, width: stroke, height: rect.height, color });
  renderer.drawRect({ x: rect.x + rect.width - stroke, y: rect.y, width: stroke, height: rect.height, color });
}

function cssToRgba(color: string, alphaMultiplier = 1): [number, number, number, number] {
  const normalized = String(color || '').trim().toLowerCase();
  if (!normalized) return [...ZERO_ALPHA_RGBA] as [number, number, number, number];

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const raw = hexMatch[1];
    const hex = raw.length === 3
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw;
    const value = Number.parseInt(hex, 16);
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
      clamp01(alphaMultiplier)
    ];
  }

  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => Number(part.trim()));
    if (parts.length >= 3) {
      const alpha = parts.length >= 4 ? clamp01(parts[3]) : 1;
      return [
        clamp01(parts[0] / 255),
        clamp01(parts[1] / 255),
        clamp01(parts[2] / 255),
        clamp01(alpha * alphaMultiplier)
      ];
    }
  }

  return [1, 1, 1, clamp01(alphaMultiplier)];
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
