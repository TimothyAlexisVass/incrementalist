import { COLORS } from '../../colors';
import { BUTTON_DEFAULT_FONT } from '../../config';

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

function drawNoticePing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const progress = getNoticePingProgress(x, y, radius);

  if (progress <= 0) {
    return;
  }

  const ringRadius = Math.max(radius, progress * NOTICE_PING_MAX_RADIUS_PX);
  const fade = Math.pow(1 - progress, 1.5);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, TWO_PI);
  ctx.lineWidth = 7;
  ctx.strokeStyle = `rgba(0, 255, 0, ${0.22 * fade})`;
  ctx.shadowColor = NOTICE_PING_COLOR;
  ctx.shadowBlur = 24 * fade;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, TWO_PI);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(0, 255, 0, ${0.75 * fade})`;
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  options: ButtonOptions = {}
) {
  if (!ctx || !rect) {
    return;
  }

  ctx.save();

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

  ctx.fillStyle = active ? activeSurface : inactiveSurface;
  ctx.fillRect(paddedRect.x, paddedRect.y, paddedRect.width, paddedRect.height);

  ctx.strokeStyle = active ? activeBorder : inactiveBorder;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(paddedRect.x, paddedRect.y, paddedRect.width, paddedRect.height);

  ctx.fillStyle = textColor;
  ctx.font = font;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';

  ctx.fillText(label, textX, textY);

  if (options.showNotice) {
    drawNoticeDot(ctx, rect.x + rect.width + 2, rect.y - 2, 4, options.showNoticePing ?? false);
  }

  ctx.restore();
}

export function drawNoticeDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number = 4,
  animated: boolean = true
) {
  if (animated) {
    drawNoticePing(ctx, x, y, radius);
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = NOTICE_PING_COLOR;
  ctx.fill();
  
  // Subtle outer glow
  ctx.lineWidth = 1;
  ctx.strokeStyle = NOTICE_PING_COLOR;
  ctx.shadowBlur = 4;
  ctx.shadowColor = NOTICE_PING_COLOR;
  ctx.stroke();
  
  ctx.restore();
}

import { InteractionState, pointInRect } from '../managers/interactions';

export function doButton(
  ctx: CanvasRenderingContext2D,
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

  drawButton(ctx, rect, label, options);

  return clicked;
}
