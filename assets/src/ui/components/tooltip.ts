import { TINY_TEXT_FONT } from '../../config';
import { getActiveWebGLRenderer } from '../../renderer/webgl';
import { parseFontSizePx } from '../../utils';

export interface TooltipOptions {
  font?: string;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  paddingX?: number;
  paddingY?: number;
  lineHeight?: number;
  offsetX?: number;
  offsetY?: number;
  margin?: number;
}

export function drawTooltip(
  canvas: HTMLCanvasElement,
  anchorPoint: { x: number; y: number },
  content: string | string[],
  options: TooltipOptions = {}
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer || !canvas || !anchorPoint) {
    return null;
  }

  const lines = normalizeTooltipLines(content);
  if (lines.length === 0) {
    return null;
  }

  const {
    font = TINY_TEXT_FONT,
    textColor = '#f4f7ff',
    backgroundColor = 'rgba(9, 14, 24, 0.94)',
    borderColor = '#6f88b4',
    paddingX = 10,
    paddingY = 8,
    lineHeight = Math.max(14, parseFontSizePx(font, 12) + 4),
    offsetX = 14,
    offsetY = 14,
    margin = 8
  } = options;

  const contentWidth = lines.reduce((widest, line) => {
    return Math.max(widest, renderer.measureTextWidth({ text: line, font }));
  }, 0);
  const width = Math.ceil(contentWidth + paddingX * 2);
  const height = Math.ceil((lines.length * lineHeight) + paddingY * 2);

  let x = anchorPoint.x + offsetX;
  let y = anchorPoint.y - height - offsetY;

  if (x + width > canvas.width - margin) {
    x = canvas.width - margin - width;
  }

  if (x < margin) {
    x = margin;
  }

  if (y < margin) {
    y = anchorPoint.y + offsetY;
  }

  if (y + height > canvas.height - margin) {
    y = canvas.height - margin - height;
  }

  renderer.drawRect({
    x,
    y,
    width,
    height,
    color: cssToRgba(backgroundColor)
  });
  drawRectOutline(renderer, x, y, width, height, 1, cssToRgba(borderColor));

  for (let i = 0; i < lines.length; i += 1) {
    renderer.drawText({
      text: lines[i],
      x: x + paddingX,
      y: y + paddingY + (i * lineHeight),
      font,
      color: textColor,
      align: 'left',
      baseline: 'top'
    });
  }

  return { x, y, width, height };
}

function normalizeTooltipLines(content: string | string[]): string[] {
  const sourceLines = Array.isArray(content)
    ? content
    : String(content ?? '').split('\n');

  return sourceLines
    .map((line) => String(line ?? '').trim())
    .filter((line) => line.length > 0);
}

function drawRectOutline(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number,
  color: [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(lineWidth) ? lineWidth : 1);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}

function cssToRgba(color: string): [number, number, number, number] {
  const normalized = String(color || '').trim().toLowerCase();
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
      1
    ];
  }

  const rgbaMatch = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => Number(part.trim()));
    if (parts.length >= 3) {
      const alpha = parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1;
      return [
        clamp01(parts[0] / 255),
        clamp01(parts[1] / 255),
        clamp01(parts[2] / 255),
        clamp01(alpha)
      ];
    }
  }

  return [1, 1, 1, 1];
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
