import { COLORS } from '../../colors';

export interface CheckboxOptions {
  trackColor?: string;
  borderColor?: string;
  checkmarkColor?: string;
  lineWidth?: number;
}

export function drawCheckbox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  checked: boolean,
  options: CheckboxOptions = {}
) {
  if (!ctx) {
    return;
  }

  const {
    trackColor = COLORS.bar.track,
    borderColor = COLORS.bar.border,
    checkmarkColor = COLORS.overlay.optionsCheckboxCheckmark,
    lineWidth = 2
  } = options;

  ctx.fillStyle = trackColor;
  ctx.fillRect(x, y, size, size);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, size, size);

  if (!checked) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = checkmarkColor;
  ctx.lineWidth = 2.25;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + (size * 0.2), y + (size * 0.55));
  ctx.lineTo(x + (size * 0.43), y + (size * 0.78));
  ctx.lineTo(x + (size * 0.82), y + (size * 0.24));
  ctx.stroke();
  ctx.restore();
}

import { InteractionState, pointInRect } from '../interaction-manager';

export function doCheckbox(
  ctx: CanvasRenderingContext2D,
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

  drawCheckbox(ctx, x, y, size, checked, drawOptions);

  return toggled;
}

