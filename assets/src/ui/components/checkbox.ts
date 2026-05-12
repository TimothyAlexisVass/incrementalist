import { COLORS } from '../../colors';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export interface CheckboxOptions {
  trackColor?: string;
  borderColor?: string;
  checkmarkColor?: string;
  lineWidth?: number;
}

export function drawCheckbox(
  x: number,
  y: number,
  size: number,
  checked: boolean,
  options: CheckboxOptions = {}
) {
  const renderer = getActiveWebGLRenderer();

  const {
    trackColor = COLORS.bar.track,
    borderColor = COLORS.bar.border,
    checkmarkColor = COLORS.overlay.optionsCheckboxCheckmark,
    lineWidth = 2
  } = options;

  renderer.drawRect({
    x,
    y,
    width: size,
    height: size,
    color: hexToRgba(trackColor)
  });
  drawRectOutline(renderer, x, y, size, size, lineWidth, hexToRgba(borderColor));

  if (!checked) {
    return;
  }

  renderer.drawText({
    text: '✓',
    x: x + size / 2,
    y: y + size / 2,
    font: `bold ${Math.max(12, Math.floor(size * 0.8))}px Arial`,
    color: checkmarkColor,
    align: 'center',
    baseline: 'middle'
  });
}

import { InteractionState, pointInRect } from '../managers/interactions';

export function doCheckbox(
  input: InteractionState,
  x: number,
  y: number,
  size: number,
  checked: boolean,
  options: CheckboxOptions = {}
): boolean {
  const isHovered = pointInRect(input.pointer, { x, y, width: size, height: size });
  let toggled = false;

  if (isHovered && input.clicked && !input.consumed) {
    toggled = true;
    input.consumed = true;
  }

  // Checkboxes might highlight their border when hovered
  const drawOptions = { ...options };
  if (isHovered) {
    drawOptions.borderColor = drawOptions.borderColor || COLORS.button.border.active;
  }

  drawCheckbox(x, y, size, checked, drawOptions);

  return toggled;
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

function hexToRgba(color: string): [number, number, number, number] {
  const normalized = String(color || '').trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) return [1, 1, 1, 1];
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
}
