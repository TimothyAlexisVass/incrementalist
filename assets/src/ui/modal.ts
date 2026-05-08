import { COLORS } from '../colors';
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from '../config';
import { drawButton } from './button';

export interface ModalState {
  open: boolean;
  title?: string;
  body?: string;
  showCancel?: boolean;
}

export interface ModalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModalLayout {
  modalRect: ModalRect;
  cancelRect: ModalRect | null;
  okRect: ModalRect;
}

export function renderConfirmationModal(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  modalState: ModalState
): ModalLayout | null {
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
    drawButton(ctx, cancelRect, 'Cancel', {
      active: false,
      activeSurface: COLORS.button.secondary.surface,
      inactiveSurface: COLORS.button.secondary.surface,
      activeBorder: COLORS.button.secondary.border,
      inactiveBorder: COLORS.button.secondary.border,
      textColor: COLORS.button.secondary.text
    });
  }

  // OK button
  drawButton(ctx, okRect, 'OK', {
    active: false,
    activeSurface: COLORS.button.surface.active,
    inactiveSurface: COLORS.button.surface.inactive,
    activeBorder: COLORS.button.border.active,
    inactiveBorder: COLORS.button.border.inactive
  });

  return {
    modalRect: { x: modalX, y: modalY, width: modalWidth, height: modalHeight },
    cancelRect: modalState.showCancel !== false ? cancelRect : null,
    okRect
  };
}

export function resolveConfirmationModalAction(layout: ModalLayout, x: number, y: number): { action: 'ok' | 'cancel' | null } {
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
