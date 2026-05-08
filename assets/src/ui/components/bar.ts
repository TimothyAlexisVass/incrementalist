import { COLORS } from '../../colors';

export interface GradientStop {
  offset: number;
  color: string;
}

export interface BarOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: number;
  orientation?: 'horizontal' | 'vertical';
  gradientStops?: GradientStop[];
  trackColor?: string;
  fillColor?: string; // Add explicit fillColor to fallback on when there are no gradientStops
  borderColor?: string;
  lineWidth?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function drawBar(ctx: CanvasRenderingContext2D, options: BarOptions) {
  if (!ctx || !options) {
    return;
  }

  const {
    x,
    y,
    width,
    height,
    ratio,
    orientation = 'horizontal',
    gradientStops = [],
    trackColor = COLORS.bar.track,
    fillColor = COLORS.bar.track, // Assuming trackColor fallback if not specified, though normally it should be different
    borderColor = COLORS.bar.border,
    lineWidth = 2
  } = options;

  // Draw track background
  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, width, height);

  const safeRatio = clamp01(ratio);

  if (safeRatio > 0) {
    if (gradientStops.length > 0) {
      const gradient = orientation === 'horizontal'
        ? ctx.createLinearGradient(x, y, x + width, y)
        : ctx.createLinearGradient(x, y + height, x, y); // Bottom-to-top gradient for vertical

      for (const stop of gradientStops) {
        gradient.addColorStop(stop.offset, stop.color);
      }
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = fillColor;
    }

    if (orientation === 'horizontal') {
      const fillWidth = Math.round(width * safeRatio);
      ctx.fillRect(x, y, fillWidth, height);
    } else {
      const fillHeight = Math.round(height * safeRatio);
      ctx.fillRect(x, y + height - fillHeight, width, fillHeight);
    }
  }

  // Draw border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, width, height);
}
