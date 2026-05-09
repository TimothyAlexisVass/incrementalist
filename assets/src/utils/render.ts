import { clampNumber } from './math';

export const LOCKED_ELEMENT_OPACITY = 0.1;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LockedDrawOptions {
  opacity?: number;
  label?: string;
  font?: string;
  textColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  textX?: number;
  textY?: number;
}

export function drawLockedElement(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  drawElement: () => void,
  options: LockedDrawOptions = {}
): void {
  if (!ctx || !rect || typeof drawElement !== 'function') {
    return;
  }

  const opacity = Number.isFinite(Number(options.opacity))
    ? clampNumber(Number(options.opacity), 0, 1)
    : LOCKED_ELEMENT_OPACITY;

  ctx.save();
  ctx.globalAlpha = opacity;
  drawElement();
  ctx.restore();

  drawLockedText(ctx, rect, options);
}

export function drawLockedText(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  options: LockedDrawOptions = {}
): void {
  if (!ctx || !rect) {
    return;
  }

  const {
    label = 'LOCKED',
    font = 'bold 12px Arial',
    textColor = '#f5f8ff',
    outlineColor = '#000000',
    outlineWidth = 3,
    textX = rect.x + (rect.width / 2),
    textY = rect.y + (rect.height / 2)
  } = options;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (outlineWidth > 0) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;
    ctx.strokeText(label, textX, textY);
  }

  ctx.fillStyle = textColor;
  ctx.fillText(label, textX, textY);
  ctx.restore();
}
