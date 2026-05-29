import { COLORS } from '../../colors';
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from '../../config';
import { getActiveWebGLRenderer } from '../../renderer/webgl';
import { hexToRgba } from '../../utils/color';
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
  canvas: HTMLCanvasElement,
  modalState: ModalState
): ModalLayout | null {
  const renderer = getActiveWebGLRenderer();
  if (!renderer || !canvas || !modalState?.open) {
    return null;
  }

  const modalWidth = 360;
  const modalHeight = 180;
  const modalX = Math.floor((canvas.width - modalWidth) / 2);
  const modalY = Math.floor((canvas.height - modalHeight) / 2);

  renderer.drawRect({
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    color: COLORS.overlay.backdrop
  });
  renderer.drawRect({
    x: modalX,
    y: modalY,
    width: modalWidth,
    height: modalHeight,
    color: hexToRgba(COLORS.panel.bg)
  });
  drawRectOutline(renderer, modalX, modalY, modalWidth, modalHeight, 2, hexToRgba(COLORS.overlay.panelBorder));

  const title = modalState.title || 'Confirm';
  renderer.drawText({
    text: title,
    x: modalX + (modalWidth / 2),
    y: modalY + 36,
    font: MODAL_TITLE_FONT,
    color: COLORS.overlay.titleText,
    align: 'center',
    baseline: 'alphabetic'
  });

  const body = modalState.body || '';
  const lines = body.split('\n');
  const lineHeight = 18;
  const startY = modalY + 70;
  for (let i = 0; i < lines.length; i += 1) {
    renderer.drawText({
      text: lines[i],
      x: modalX + (modalWidth / 2),
      y: startY + (i * lineHeight),
      font: MODAL_BODY_FONT,
      color: COLORS.overlay.bodyText,
      align: 'center',
      baseline: 'alphabetic'
    });
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
    drawButton(cancelRect, 'Cancel', {
      active: false,
      activeSurface: COLORS.button.secondary.surface,
      inactiveSurface: COLORS.button.secondary.surface,
      activeBorder: COLORS.button.secondary.border,
      inactiveBorder: COLORS.button.secondary.border,
      textColor: COLORS.button.secondary.text
    });
  }

  // OK button
  drawButton(okRect, 'OK', {
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

function drawRectOutline(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  color: readonly [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(borderWidth) ? borderWidth : 1);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}


