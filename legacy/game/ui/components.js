import { COLORS } from '../colors.js';
import { 
  BUTTON_DEFAULT_FONT,
  MODAL_TITLE_FONT,
  MODAL_BODY_FONT,
  TINY_TEXT_FONT
} from '../config.js';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function drawButton(ctx, rect, label, options = {}) {
  if (!ctx || !rect) {
    return;
  }

  const {
    active = false,
    activeSurface = COLORS.button.surface.active,
    inactiveSurface = COLORS.button.surface.inactive,
    activeBorder = COLORS.button.border.active,
    inactiveBorder = COLORS.button.border.inactive,
    textColor = COLORS.button.text,
    lineWidth = 2,
    font = BUTTON_DEFAULT_FONT,
    textAlign = 'center',
    textX = rect.x + (rect.width / 2),
    textY = rect.y + 19
  } = options;

  ctx.fillStyle = active ? activeSurface : inactiveSurface;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  ctx.strokeStyle = active ? activeBorder : inactiveBorder;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  ctx.fillStyle = textColor;
  ctx.font = font;
  ctx.textAlign = textAlign;
  ctx.fillText(label, textX, textY);
}

export function drawCheckbox(ctx, x, y, size, checked, options = {}) {
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

export function drawHorizontalBar(ctx, options) {
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
      ctx.fillStyle = trackColor;
    }
    ctx.fillRect(x, y, fillWidth, height);
  }

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, width, height);
}

export function drawTooltip(ctx, canvas, anchorPoint, content, options = {}) {
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
    lineHeight = Math.max(14, parseFontSizePx(font) + 4),
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

export function renderConfirmationModal(ctx, canvas, modalState) {
  if (!ctx || !canvas || !modalState?.open) {
    return null;
  }

  const modalWidth = 360;
  const modalHeight = 180;
  const modalX = Math.floor((canvas.width - modalWidth) / 2);
  const modalY = Math.floor((canvas.height - modalHeight) / 2);

  // Draw backdrop
  ctx.fillStyle = COLORS.overlay.backdrop;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw modal panel
  ctx.fillStyle = COLORS.overlay.panel;
  ctx.fillRect(modalX, modalY, modalWidth, modalHeight);
  ctx.strokeStyle = COLORS.overlay.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);

  // Draw title
  const title = modalState.title || 'Confirm';
  ctx.fillStyle = COLORS.overlay.titleText;
  ctx.font = MODAL_TITLE_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(title, modalX + (modalWidth / 2), modalY + 36);

  // Draw body text (supports multiple lines)
  const body = modalState.body || '';
  const lines = body.split('\n');
  ctx.font = MODAL_BODY_FONT;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.overlay.bodyText;
  const lineHeight = 18;
  const startY = modalY + 70;
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], modalX + (modalWidth / 2), startY + (i * lineHeight));
  }

  // Draw buttons
  const buttonWidth = 100;
  const buttonHeight = 32;
  const buttonY = modalY + modalHeight - 52;
  const buttonGap = 16;
  const totalButtonWidth = (buttonWidth * 2) + buttonGap;
  const buttonStartX = modalX + Math.floor((modalWidth - totalButtonWidth) / 2);

  const cancelRect = {
    x: buttonStartX,
    y: buttonY,
    width: buttonWidth,
    height: buttonHeight
  };

  const okRect = {
    x: buttonStartX + buttonWidth + buttonGap,
    y: buttonY,
    width: buttonWidth,
    height: buttonHeight
  };

  // Cancel button (only drawn if showCancel is true)
  if (modalState.showCancel !== false) {
    drawButton(ctx, cancelRect, 'Cancel', { active: false, activeSurface: COLORS.button.secondary.surface, inactiveSurface: COLORS.button.secondary.surface, activeBorder: COLORS.button.secondary.border, inactiveBorder: COLORS.button.secondary.border, textColor: COLORS.button.secondary.text });
  }

  // OK button
  drawButton(ctx, okRect, 'OK', { active: false, activeSurface: COLORS.button.surface.active, inactiveSurface: COLORS.button.surface.inactive, activeBorder: COLORS.button.border.active, inactiveBorder: COLORS.button.border.inactive });

  return {
    modalRect: { x: modalX, y: modalY, width: modalWidth, height: modalHeight },
    cancelRect: modalState.showCancel !== false ? cancelRect : null,
    okRect
  };
}

export function resolveConfirmationModalAction(layout, x, y) {
  if (!layout) {
    return { action: null };
  }

  if (layout.okRect) {
    const { okRect } = layout;
    if (x >= okRect.x && x <= okRect.x + okRect.width && y >= okRect.y && y <= okRect.y + okRect.height) {
      return { action: 'ok' };
    }
  }

  if (layout.cancelRect) {
    const { cancelRect } = layout;
    if (x >= cancelRect.x && x <= cancelRect.x + cancelRect.width && y >= cancelRect.y && y <= cancelRect.y + cancelRect.height) {
      return { action: 'cancel' };
    }
  }

  return { action: null };
}

function normalizeTooltipLines(content) {
  const sourceLines = Array.isArray(content)
    ? content
    : String(content ?? '').split('\n');

  return sourceLines
    .map((line) => String(line ?? '').trim())
    .filter((line) => line.length > 0);
}

function parseFontSizePx(font) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || '');
  if (!match) {
    return 12;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 12;
}
