import { clampNumber } from './math';
import { getActiveWebGLRenderer } from '../renderer/webgl';

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
  _ctx: CanvasRenderingContext2D,
  rect: Rect,
  drawElement: () => void,
  options: LockedDrawOptions = {}
): void {
  if (!rect || typeof drawElement !== 'function') {
    return;
  }

  const opacity = Number.isFinite(Number(options.opacity))
    ? clampNumber(Number(options.opacity), 0, 1)
    : LOCKED_ELEMENT_OPACITY;

  void opacity;
  drawElement();

  drawLockedText(_ctx, rect, options);
}

export function drawLockedText(
  _ctx: CanvasRenderingContext2D,
  rect: Rect,
  options: LockedDrawOptions = {}
): void {
  if (!rect) {
    return;
  }
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const {
    label = 'LOCKED',
    font = 'bold 12px Arial',
    textColor = '#f5f8ff',
    outlineColor = '#000000',
    outlineWidth = 3,
    textX = rect.x + (rect.width / 2),
    textY = rect.y + (rect.height / 2) + 1,
    showNotice = false,
    showNoticePing = false
  } = options;

  if (outlineWidth > 0) {
    renderer.drawText({ text: label, x: textX - 1, y: textY, font, color: outlineColor, align: 'center', baseline: 'middle' });
    renderer.drawText({ text: label, x: textX + 1, y: textY, font, color: outlineColor, align: 'center', baseline: 'middle' });
    renderer.drawText({ text: label, x: textX, y: textY - 1, font, color: outlineColor, align: 'center', baseline: 'middle' });
    renderer.drawText({ text: label, x: textX, y: textY + 1, font, color: outlineColor, align: 'center', baseline: 'middle' });
  }
  renderer.drawText({ text: label, x: textX, y: textY, font, color: textColor, align: 'center', baseline: 'middle' });

  if (showNotice) {
    const textWidth = renderer.measureTextWidth({ text: label, font });
    const fallbackAscent = estimateFontAscent(font);
    const textTop = textY - fallbackAscent;
    const textRight = textX + textWidth / 2;

    const noticeRadius = 4;
    const noticeX = textRight + noticeRadius + 2;
    const noticeY = textTop + noticeRadius - 8;
    renderer.drawCircle(noticeX, noticeY, noticeRadius, [1, 0.32, 0.32, 1]);
    if (showNoticePing) {
      renderer.drawCircle(noticeX, noticeY, noticeRadius + 3, [1, 0.32, 0.32, 0.2]);
    }
  }
}

function estimateFontAscent(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/i.exec(font);
  const px = match ? Number.parseFloat(match[1]) : 12;
  return px * 0.8;
}
