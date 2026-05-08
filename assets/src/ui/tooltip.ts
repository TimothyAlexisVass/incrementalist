import { TINY_TEXT_FONT } from '../config';
import { parseFontSizePx } from '../utils';

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
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  anchorPoint: { x: number; y: number },
  content: string | string[],
  options: TooltipOptions = {}
) {
  if (!ctx || !canvas || !anchorPoint) {
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

  ctx.save();
  ctx.font = font;

  const contentWidth = lines.reduce((widest, line) => {
    return Math.max(widest, ctx.measureText(line).width);
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

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x + paddingX, y + paddingY + (i * lineHeight));
  }

  ctx.restore();

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
