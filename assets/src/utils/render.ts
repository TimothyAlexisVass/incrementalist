import { clampNumber } from './math';
import { drawNoticeDot } from '../ui/components/button';

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
  showNotice?: boolean;
  showNoticePing?: boolean;
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
    textY = rect.y + (rect.height / 2),
    showNotice = false,
    showNoticePing = false
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

  if (showNotice) {
    const textMetrics = ctx.measureText(label);
    const fallbackAscent = estimateFontAscent(font);
    const textTop = textY - (textMetrics.actualBoundingBoxAscent || fallbackAscent);
    const textRight =
      textX +
      (textMetrics.actualBoundingBoxRight > 0
        ? textMetrics.actualBoundingBoxRight
        : textMetrics.width / 2);

    const noticeRadius = 4;
    const noticeX = textRight + noticeRadius + 2;
    const noticeY = textTop + noticeRadius - 8;
    drawNoticeDot(ctx, noticeX, noticeY, noticeRadius, showNoticePing);
  }

  ctx.restore();
}

function estimateFontAscent(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/i.exec(font);
  const px = match ? Number.parseFloat(match[1]) : 12;
  return px * 0.8;
}
