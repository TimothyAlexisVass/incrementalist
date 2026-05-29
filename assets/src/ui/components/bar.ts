import { COLORS } from '../../colors';
import { getActiveWebGLRenderer } from '../../renderer/webgl';
import { cssToRgba, type RGBA } from '../../utils/color';

export interface HorizontalBarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HorizontalBarOptions {
  fillRatio: number;
  fillStartColor: BarColor;
  fillEndColor?: BarColor;
  trackColor?: BarColor;
  borderColor?: BarColor;
  borderWidth?: number;
}

type BarColor = string | readonly [number, number, number] | readonly [number, number, number, number];

export function drawHorizontalBar(rect: HorizontalBarRect, options: HorizontalBarOptions) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) {
    return;
  }

  const {
    fillRatio,
    fillStartColor,
    fillEndColor = fillStartColor,
    trackColor = COLORS.bar.track,
    borderColor = COLORS.bar.border,
    borderWidth = 2
  } = options;

  const width = Math.max(0, rect.width);
  const height = Math.max(0, rect.height);
  if (width <= 0 || height <= 0) {
    return;
  }

  const clampedFillRatio = clamp01(fillRatio);

  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width,
    height,
    color: normalizeColor(trackColor)
  });

  if (clampedFillRatio > 0) {
    const fillRect = {
      x: rect.x,
      y: rect.y,
      width: width * clampedFillRatio,
      height
    };

    renderer.withScissorRect(fillRect, () => {
      renderer.drawGradientRect({
        x: rect.x,
        y: rect.y,
        width,
        height,
        colorStart: normalizeColor(fillStartColor),
        colorEnd: normalizeColor(fillEndColor)
      });
    });
  }

  drawRectOutline(renderer, rect, borderWidth, normalizeColor(borderColor));
}

export function getHorizontalBarCenterY(rect: HorizontalBarRect) {
  return rect.y + (rect.height / 2);
}

function drawRectOutline(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  rect: HorizontalBarRect,
  borderWidth: number,
  color: RGBA
) {
  const stroke = Math.max(1, Number.isFinite(borderWidth) ? borderWidth : 1);
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: stroke, color });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - stroke, width: rect.width, height: stroke, color });
  renderer.drawRect({ x: rect.x, y: rect.y, width: stroke, height: rect.height, color });
  renderer.drawRect({ x: rect.x + rect.width - stroke, y: rect.y, width: stroke, height: rect.height, color });
}

function normalizeColor(color: BarColor): RGBA {
  if (typeof color === 'string') {
    return cssToRgba(color);
  }

  if (Array.isArray(color)) {
    const [r, g, b, a = 1] = color;
    return [r, g, b, a];
  }

  return [1, 1, 1, 1];
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
