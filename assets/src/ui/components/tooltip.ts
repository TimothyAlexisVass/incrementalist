import { SMALL_TEXT_FONT } from '../../config';
import { getActiveWebGLRenderer } from '../../renderer/webgl';
import { parseFontSizePx } from '../../utils';
import { resolveStableMultilineText } from '../../renderer/stable-text';

export interface TooltipRow {
  label: string;
  value?: string;
  color?: string;
  font?: string;
  align?: 'left' | 'center' | 'right';
}

export type TooltipContent = string | string[] | TooltipRow[];

export interface TooltipOptions {
  width?: number;
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
  widthMode?: 'measured' | 'estimated';
  estimatedWidthFactor?: number;
  widthScale?: number;
  textUpdateKey?: string;
  lineColors?: string[];
  lineFonts?: string[];
  placement?: TooltipPlacement;
  align?: 'left' | 'center' | 'right';
}

export type TooltipPlacement =
  | 'top-left'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom-right';

interface TooltipRequest {
  anchorPoint: { x: number; y: number };
  content: TooltipContent;
  options: TooltipOptions;
}

const queuedTooltips: TooltipRequest[] = [];

export function beginTooltipFrame() {
  queuedTooltips.length = 0;
}

export function queueTooltip(
  anchorPoint: { x: number; y: number },
  content: TooltipContent,
  options: TooltipOptions = {}
) {
  queuedTooltips.push({ anchorPoint, content, options });
}

export function renderQueuedTooltips() {
  const renderer = getActiveWebGLRenderer();
  if (!renderer || queuedTooltips.length === 0) {
    queuedTooltips.length = 0;
    return;
  }

  for (const request of queuedTooltips) {
    drawTooltipInternal(renderer, request.anchorPoint, request.content, request.options);
  }

  queuedTooltips.length = 0;
}

export function drawTooltip(
  anchorPoint: { x: number; y: number },
  content: TooltipContent,
  options: TooltipOptions = {}
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return null;
  return drawTooltipInternal(renderer, anchorPoint, content, options);
}

function drawTooltipInternal(
  renderer: import('../../renderer/webgl').WebGLRenderer,
  anchorPoint: { x: number; y: number },
  content: TooltipContent,
  options: TooltipOptions = {}
) {
  const canvas = renderer.canvasElement;
  if (!canvas || !anchorPoint) {
    return null;
  }

  const {
    font = SMALL_TEXT_FONT,
    textColor = '#f4f7ff',
    backgroundColor = 'rgba(9, 14, 24, 0.94)',
    borderColor = '#6f88b4',
    paddingX = 10,
    paddingY = 8,
    lineHeight = Math.max(14, parseFontSizePx(font, 12) + 4),
    offsetX = 14,
    offsetY = 14,
    margin = 8,
    widthMode = 'measured',
    estimatedWidthFactor = 0.62,
    widthScale = 1,
    textUpdateKey,
    placement = 'top-left'
  } = options;

  const isTable = Array.isArray(content) && content.length > 0 && typeof content[0] === 'object';
  const tableRows = isTable ? (content as TooltipRow[]) : null;

  let labels: string[] = [];
  let values: string[] = [];
  let stringLines: string[] = [];

  if (isTable && tableRows) {
    const rawLabels = tableRows.map((r) => r.label);
    const rawValues = tableRows.map((r) => r.value || '');
    const lineFonts = tableRows.map((r) => r.font || (r.value === undefined || r.value === '' ? font : '12px "Courier New", monospace'));
    const lineColors = tableRows.map((r) => r.color || textColor);
    
    labels = resolveStableMultilineText(
      textUpdateKey ? `${textUpdateKey}.labels` : undefined,
      rawLabels,
      { font, color: textColor, align: 'left', baseline: 'top', lineFonts, lineColors }
    );
    values = resolveStableMultilineText(
      textUpdateKey ? `${textUpdateKey}.values` : undefined,
      rawValues,
      { font, color: textColor, align: 'right', baseline: 'top', lineFonts, lineColors }
    );
  } else {
    stringLines = resolveStableMultilineText(
      textUpdateKey,
      normalizeTooltipLines(content as string | string[]),
      {
        font,
        color: textColor,
        align: options.align || 'left',
        baseline: 'top',
        lineFonts: options.lineFonts,
        lineColors: options.lineColors,
      }
    );
  }

  const rowCount = isTable && tableRows ? tableRows.length : stringLines.length;
  if (rowCount === 0) {
    return null;
  }

  let contentWidth = 0;
  if (isTable && tableRows) {
    for (let i = 0; i < rowCount; i++) {
      const isSingleLine = tableRows[i].value === undefined || tableRows[i].value === '';
      const rowFont = tableRows[i].font || (isSingleLine ? font : '12px "Courier New", monospace');
      const labelWidth = widthMode === 'estimated' 
         ? labels[i].length * parseFontSizePx(rowFont, 12) * estimatedWidthFactor
         : renderer.measureTextWidth({ text: labels[i], font: rowFont });
         
      if (isSingleLine) {
        contentWidth = Math.max(contentWidth, labelWidth);
      } else {
        const valueWidth = widthMode === 'estimated' 
           ? values[i].length * parseFontSizePx(rowFont, 12) * estimatedWidthFactor
           : renderer.measureTextWidth({ text: values[i], font: rowFont });
        const gap = 16;
        contentWidth = Math.max(contentWidth, labelWidth + gap + valueWidth);
      }
    }
  } else {
    contentWidth = stringLines.reduce((widest, line, i) => {
      const lineFont = (options.lineFonts && options.lineFonts[i]) || font;
      const textWidth = widthMode === 'estimated'
        ? (line.length * parseFontSizePx(lineFont, 12) * estimatedWidthFactor)
        : renderer.measureTextWidth({ text: line, font: lineFont });
      return Math.max(widest, textWidth);
    }, 0);
  }

  const width = options.width !== undefined 
    ? options.width 
    : Math.ceil((contentWidth + paddingX * 2) * Math.max(0.1, widthScale));
  const height = Math.ceil((rowCount * lineHeight) + paddingY * 2);

  const placementGapX = Math.max(0, offsetX);
  const placementGapY = Math.max(0, offsetY);
  let x = anchorPoint.x - width;
  let y = anchorPoint.y - height - placementGapY;

  if (placement === 'top-right') {
    x = anchorPoint.x + placementGapX;
  } else if (placement === 'left') {
    x = anchorPoint.x - width - placementGapX;
    y = anchorPoint.y - (height / 2);
  } else if (placement === 'right') {
    x = anchorPoint.x + placementGapX;
    y = anchorPoint.y - (height / 2);
  } else if (placement === 'bottom-left') {
    x = anchorPoint.x - width - placementGapX;
    y = anchorPoint.y + placementGapY;
  } else if (placement === 'bottom-right') {
    x = anchorPoint.x + placementGapX;
    y = anchorPoint.y + placementGapY;
  }

  if (x < margin) {
    x = margin;
  }

  if (x + width > canvas.width - margin) {
    x = canvas.width - margin - width;
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

  if (isTable && tableRows) {
    for (let i = 0; i < rowCount; i += 1) {
      const row = tableRows[i];
      const lineColor = row.color || textColor;
      const isSingleLine = row.value === undefined || row.value === '';
      const rowFont = row.font || (isSingleLine ? font : '12px "Courier New", monospace');
      const yPos = y + paddingY + (i * lineHeight);
      
      if (isSingleLine) {
        const rowAlign = row.align || 'center';
        const textX = rowAlign === 'center'
          ? x + (width / 2)
          : rowAlign === 'right'
            ? x + width - paddingX
            : x + paddingX;
        renderer.drawText({
          text: labels[i],
          x: textX,
          y: yPos,
          font: rowFont,
          color: lineColor,
          align: rowAlign,
          baseline: 'top'
        });
      } else {
        renderer.drawText({
          text: labels[i],
          x: x + paddingX,
          y: yPos,
          font: rowFont,
          color: lineColor,
          align: 'left',
          baseline: 'top'
        });

        renderer.drawText({
          text: values[i],
          x: x + width - paddingX,
          y: yPos,
          font: rowFont,
          color: lineColor,
          align: 'right',
          baseline: 'top'
        });
      }
    }
  } else {
    for (let i = 0; i < rowCount; i += 1) {
      const lineColor = (options.lineColors && options.lineColors[i]) || textColor;
      const lineFont = (options.lineFonts && options.lineFonts[i]) || font;
      const lineAlign = options.align || 'left';
      const textX = lineAlign === 'center'
        ? x + (width / 2)
        : lineAlign === 'right'
          ? x + width - paddingX
          : x + paddingX;
      renderer.drawText({
        text: stringLines[i],
        x: textX,
        y: y + paddingY + (i * lineHeight),
        font: lineFont,
        color: lineColor,
        align: lineAlign,
        baseline: 'top'
      });
    }
  }

  return { x, y, width, height };
}

function normalizeTooltipLines(content: string | string[]): string[] {
  const sourceLines = Array.isArray(content)
    ? content
    : String(content ?? '').split('\n');

  return sourceLines
    .map((line) => String(line ?? '').trim());
}

function drawRectOutline(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  color: [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(borderWidth) ? borderWidth : 1);
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
