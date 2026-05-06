export function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export const LOCKED_ELEMENT_OPACITY = 0.1;

export function drawLockedElement(ctx, rect, drawElement, options = {}) {
  if (!ctx || !rect || typeof drawElement !== 'function') {
    return;
  }

  const opacity = Number.isFinite(Number(options.opacity))
    ? clampNumber(Number(options.opacity), 0, 1)
    : LOCKED_ELEMENT_OPACITY;

  ctx.save();
  ctx.globalAlpha = opacity;
  drawElement();
  ctx.restore();

  drawLockedText(ctx, rect, options);
}

export function drawLockedText(ctx, rect, options = {}) {
  if (!ctx || !rect) {
    return;
  }

  const {
    label = 'LOCKED',
    font = 'bold 12px Arial',
    textColor = '#f5f8ff',
    outlineColor = '#000000',
    outlineWidth = 3,
    textX = rect.x + (rect.width / 2),
    textY = rect.y + (rect.height / 2)
  } = options;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (outlineWidth > 0) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;
    ctx.strokeText(label, textX, textY);
  }

  ctx.fillStyle = textColor;
  ctx.fillText(label, textX, textY);
  ctx.restore();
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpColor(c1, c2, t) {
  return [
    Math.floor(lerp(c1[0], c2[0], t)),
    Math.floor(lerp(c1[1], c2[1], t)),
    Math.floor(lerp(c1[2], c2[2], t))
  ];
}

export function hexToRgbArray(color) {
  if (Array.isArray(color)) {
    return color.slice(0, 3);
  }

  if (typeof color !== 'string') {
    return [0, 0, 0];
  }

  const hex = color.trim().replace(/^#/, '');
  const expanded = hex.length === 3
    ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    : hex;
  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return [0, 0, 0];
  }

  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255
  ];
}

export function rgbArrayToCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
