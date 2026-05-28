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
  borderWidth?: number;
  font?: string;
  textAlign?: CanvasTextAlign;
  textX?: number;
  textY?: number;
  showNotice?: boolean;
}

const NOTICE_PING_INTERVAL_MS = 8_000;
const NOTICE_PING_DURATION_MS = 2_000;
const NOTICE_PING_MAX_RADIUS_PX = 120;
const NOTICE_PING_COLOR = '#00ff00';
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

  const pingRadius = radius + (progress * (NOTICE_PING_MAX_RADIUS_PX - radius));
  const fade = Math.pow(1.0 - progress, 2.5);

  // Large ethereal glow ring (very soft) - USING ADDITIVE BLENDING
  renderer.drawRing(x, y, pingRadius, 2, [0, 1, 0, 0.4 * fade], 0.95, "additive");
  // Sharper inner edge for definition
  renderer.drawRing(x, y, pingRadius, 1, [0.5, 1, 0.5, 0.6 * fade], 0.2, "additive");
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
    borderWidth = 2,
    font = BUTTON_DEFAULT_FONT,
    textAlign = 'center',
    textX = rect.x + (rect.width / 2),
    textY = rect.y + (rect.height / 2)
  } = options;

  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: cssToRgba(active ? activeSurface : inactiveSurface)
  });
  drawRectOutline(renderer, rect, borderWidth, cssToRgba(active ? activeBorder : inactiveBorder));
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
    drawNoticeDot(rect.x + rect.width - 1, rect.y + 1, 4);
  }
}

export function drawNoticeDot(
  x: number,
  y: number,
  radius: number = 4
) {
  const renderer = getActiveWebGLRenderer();
  renderer.withScissorDisabled(() => {
    drawNoticePing(x, y, radius);

    const color = cssToRgba(NOTICE_PING_COLOR);

    // Outer glow (soft) - USING ADDITIVE BLENDING
    // renderer.drawCircle(x, y, radius * 1.3, [color[0], color[1], color[2], 0.25], 0.9, "additive");
    // Main dot core (bright, solid)
    renderer.drawCircle(x, y, radius, color, 0.05, "normal");
  });
}

import { InteractionState, pointInRect } from '../managers/interactions';

export function isButtonClicked(
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  consume = true
): boolean {
  if (input.consumed || !input.clicked) return false;

  const isHovered = pointInRect(input.pointer, rect);
  const startedInside = pointInRect(input.pressStartPointer, rect);
  const hit = isHovered && startedInside;

  if (hit && consume) {
    input.consumed = true;
  }

  return hit;
}

export function doButton(
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  options: ButtonOptions = {}
): boolean {
  const clicked = isButtonClicked(input, rect);

  // Visual "active" state:
  // 1. If currently pressing, only show active if started inside and still hovering
  // 2. If not pressing, show active if hovering
  const isHovered = pointInRect(input.pointer, rect);
  const startedInside = pointInRect(input.pressStartPointer, rect);
  const isDown = input.isPressed;
  options.active = isDown ? (startedInside && isHovered) : isHovered;

  drawButton(rect, label, options);

  return clicked;
}

function drawRectOutline(
  renderer: ReturnType<typeof getActiveWebGLRenderer>,
  rect: { x: number; y: number; width: number; height: number },
  borderWidth: number,
  color: readonly [number, number, number, number]
) {
  const stroke = Number.isFinite(borderWidth) ? borderWidth : 1;
  if (stroke <= 0) return;
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
