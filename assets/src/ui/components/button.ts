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
  ctx.restore();
}

import { InputState, pointInRect } from '../input';

export function doButton(
  ctx: CanvasRenderingContext2D,
  input: InputState,
  rect: { x: number; y: number; width: number; height: number },
  label: string,
  options: ButtonOptions = {}
): boolean {
  const isHovered = pointInRect(input.pointer, rect);
  let clicked = false;

  if (isHovered && input.clicked && !input.consumed) {
    clicked = true;
    input.consumed = true; // Block clicks falling through to game world
  }

  options.active = isHovered;
  drawButton(ctx, rect, label, options);

  return clicked;
}

