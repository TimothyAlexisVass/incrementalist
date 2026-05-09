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
  showNotice?: boolean;
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
    textY = rect.y + 19
  } = options;

  ctx.fillStyle = active ? activeSurface : inactiveSurface;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  ctx.strokeStyle = active ? activeBorder : inactiveBorder;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  ctx.fillStyle = textColor;
  ctx.font = font;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';
  
  // Use explicitly provided textY, or default to exact middle of the rect
  const actualTextY = options.textY !== undefined ? options.textY : rect.y + (rect.height / 2) + 1;
  ctx.fillText(label, textX, actualTextY);
  
  if (options.showNotice) {
    drawNoticeDot(ctx, rect.x + rect.width - 2, rect.y + 2);
  }

  ctx.restore();
}

export function drawNoticeDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number = 4) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#00ff00'; // Pure green for the dot
  ctx.fill();
  
  // Subtle outer glow
  ctx.shadowBlur = 4;
  ctx.shadowColor = '#00ff00';
  ctx.stroke();
  
  ctx.restore();
}

import { InteractionState, pointInRect } from '../interaction-manager';

export function doButton(
  ctx: CanvasRenderingContext2D,
  input: InteractionState,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  options: ButtonOptions = {}
): boolean {
  const isHovered = pointInRect(input.pointer, rect);
  const startedInside = pointInRect(input.pressStartPointer, rect);
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

