import { COLORS } from '../colors';

export interface GradientStop {
  offset: number;
  color: string;
}

export interface HorizontalBarOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: number;
  gradientStops?: GradientStop[];
  trackColor?: string;
  borderColor?: string;
  lineWidth?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function drawHorizontalBar(ctx: CanvasRenderingContext2D, options: HorizontalBarOptions) {
  if (!ctx || !options) {
    return;
  }

  const {
    x,
    y,
    width,
    height,
    ratio,
    gradientStops = [],
    trackColor = COLORS.bar.track,
    borderColor = COLORS.bar.border,
    lineWidth = 2
  } = options;

  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, width, height);

  const fillWidth = Math.round(width * clamp01(ratio));
  if (fillWidth > 0) {
    if (gradientStops.length > 0) {
      const gradient = ctx.createLinearGradient(x, y, x + width, y);
      for (const stop of gradientStops) {
        gradient.addColorStop(stop.offset, stop.color);
      }
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = trackColor; // Fallback to track color if no gradient (or should it be a fill color?)
      // Actually in the original it was trackColor which seems wrong if ratio > 0, 
      // but let's stick to what was there or improve it.
      // Looking at the original:
      // } else {
      //   ctx.fillStyle = trackColor;
      // }
      // ctx.fillRect(x, y, fillWidth, height);
      // Wait, if it's the same color as the background, it won't be visible.
      // But maybe trackColor IS the fill color in some contexts?
    }
    ctx.fillRect(x, y, fillWidth, height);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, width, height);
}
