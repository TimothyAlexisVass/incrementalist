import { Modal } from '../../managers/modals';
import { COLORS } from '../../../colors';
import { InteractionState, pointInRect } from '../../managers/interactions';
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from '../../../config';
import { drawButton, doButton } from '../button';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

export class ResetConfirmationModal implements Modal {
  public readonly isBlocking = true;
  private holdTime = 0;
  private readonly requiredHoldTime = 3000;
  private okRect: { x: number; y: number; width: number; height: number } | null = null;

  constructor(
    private title: string,
    private body: string,
    private onConfirm: () => void,
    private onCancel: () => void
  ) {}

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    const renderer = getActiveWebGLRenderer();
    if (!renderer) {
      return;
    }

    const modalWidth = 400;
    const modalHeight = 220;
    const modalX = (canvas.width - modalWidth) / 2;
    const modalY = (canvas.height - modalHeight) / 2;

    renderer.drawRect({
      x: modalX,
      y: modalY,
      width: modalWidth,
      height: modalHeight,
      color: cssToRgba(COLORS.panel.bg)
    });
    drawRectOutline(renderer, modalX, modalY, modalWidth, modalHeight, 2, cssToRgba(COLORS.overlay.panelBorder));
    renderer.drawText({
      text: this.title,
      x: modalX + modalWidth / 2,
      y: modalY + 20,
      font: MODAL_TITLE_FONT,
      color: COLORS.overlay.titleText,
      align: 'center',
      baseline: 'top'
    });

    const lines = this.body.split('\n');
    lines.forEach((line, i) => {
      renderer.drawText({
        text: line,
        x: modalX + modalWidth / 2,
        y: modalY + 60 + i * 20,
        font: MODAL_BODY_FONT,
        color: COLORS.overlay.bodyText,
        align: 'center',
        baseline: 'top'
      });
    });

    // Buttons
    const btnWidth = 140;
    const btnHeight = 40;
    const btnY = modalY + modalHeight - 60;
    
    const cancelRect = { x: modalX + 40, y: btnY, width: btnWidth, height: btnHeight };
    this.okRect = { x: modalX + modalWidth - 40 - btnWidth, y: btnY, width: btnWidth, height: btnHeight };

    const cancelClicked = doButton(input, cancelRect, 'Cancel', {
        activeSurface: COLORS.button.secondary.surface,
        inactiveSurface: COLORS.button.secondary.surface,
        activeBorder: COLORS.button.secondary.border,
        inactiveBorder: COLORS.button.secondary.border,
        textColor: COLORS.button.secondary.text
    });
    if (cancelClicked) {
        this.onCancel();
    }

    // OK Button with hold progress
    const isHoveringOk = pointInRect(input.pointer, this.okRect);
    const isHoldingOk = isHoveringOk && input.isPressed;
    
    const holdProgress = Math.min(1, this.holdTime / this.requiredHoldTime);
    
    const label = holdProgress > 0 
        ? `HOLD (${Math.ceil((this.requiredHoldTime - this.holdTime)/1000)}s)` 
        : 'HOLD TO RESET';
        
    drawButton(this.okRect, label, {
        active: isHoveringOk,
        activeSurface: COLORS.button.surface.active,
        inactiveSurface: COLORS.button.surface.inactive
    });

    // Draw progress bar on top of OK button
    if (holdProgress > 0) {
        renderer.drawRect({
          x: this.okRect.x,
          y: this.okRect.y + this.okRect.height - 6,
          width: this.okRect.width * holdProgress,
          height: 6,
          color: [1, 1, 1, 0.4]
        });
    }
  }

  tick(dt: number, input: InteractionState) {
    if (this.okRect && pointInRect(input.pointer, this.okRect) && input.isPressed) {
        this.holdTime += dt;
        if (this.holdTime >= this.requiredHoldTime) {
            this.onConfirm();
            this.holdTime = 0; // Reset for next time
        }
    } else {
        this.holdTime = Math.max(0, this.holdTime - dt * 2); // Faster decay
    }
  }
}

export class LoadingModal implements Modal {
    public readonly isBlocking = true;
    private angle = 0;

    constructor(private message: string = 'Loading authoritative state...') {}

    render(canvas: HTMLCanvasElement, input: InteractionState) {
        const renderer = getActiveWebGLRenderer();
        if (!renderer) {
          return;
        }

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        const spinnerWidth = 120;
        const spinnerHeight = 10;
        const spinnerX = centerX - spinnerWidth / 2;
        const spinnerY = centerY - 12;
        const cycle = ((this.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const progress = cycle / (Math.PI * 2);
        const chunkWidth = spinnerWidth * 0.22;
        const chunkX = spinnerX + (spinnerWidth - chunkWidth) * progress;

        renderer.drawRect({
          x: spinnerX,
          y: spinnerY,
          width: spinnerWidth,
          height: spinnerHeight,
          color: cssToRgba(COLORS.bar.track)
        });
        drawRectOutline(renderer, spinnerX, spinnerY, spinnerWidth, spinnerHeight, 1, cssToRgba(COLORS.bar.border));
        renderer.drawRect({
          x: chunkX,
          y: spinnerY + 1,
          width: chunkWidth,
          height: spinnerHeight - 2,
          color: cssToRgba(COLORS.panel.textPrimary)
        });
        renderer.drawText({
          text: this.message,
          x: centerX,
          y: centerY + 60,
          font: 'bold 16px Arial',
          color: COLORS.panel.textPrimary,
          align: 'center',
          baseline: 'alphabetic'
        });
        
        // Non-dismissible: we don't handle onClose or any clicks here.
        input.consumed = true;
    }

    tick(dt: number, input: InteractionState) {
        this.angle += dt * 0.005;
        input.consumed = true;
    }
}

function drawRectOutline(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  color: [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(borderWidth) ? borderWidth : 1);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}

function cssToRgba(color: string): [number, number, number, number] {
  const normalized = String(color || '').trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) return [1, 1, 1, 1];
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
}
