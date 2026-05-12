import { COLORS } from '../../colors';
import { getActiveWebGLRenderer } from '../../renderer/webgl';
import { hexToRgba, RGBA } from '../../utils/color';

export interface CheckboxOptions {
  trackColor?: string;
  borderColor?: string;
  checkmarkColor?: string;
  borderWidth?: number;
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
    borderWidth = 2
  } = options;

  renderer.drawRect({
    x,
    y,
    width: size,
    height: size,
    color: hexToRgba(trackColor)
  });
  drawRectOutline(renderer, x, y, size, size, borderWidth, hexToRgba(borderColor));

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
  borderWidth: number,
  color: RGBA
) {
  const stroke = Math.max(1, Number.isFinite(borderWidth) ? borderWidth : 1);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}

