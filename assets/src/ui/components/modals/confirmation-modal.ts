import { Modal } from '../../managers/modals';
import { COLORS } from '../../../colors';
import { InteractionState, pointInRect } from '../../managers/interactions';
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from '../../../config';
import { drawButton, doButton } from '../button';

export class ResetConfirmationModal implements Modal {
  private holdTime = 0;
  private readonly requiredHoldTime = 3000;
  private okRect: { x: number; y: number; width: number; height: number } | null = null;

  constructor(
    private title: string,
    private body: string,
    private onConfirm: () => void,
    private onCancel: () => void
  ) {}

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState) {
    const modalWidth = 400;
    const modalHeight = 220;
    const modalX = (canvas.width - modalWidth) / 2;
    const modalY = (canvas.height - modalHeight) / 2;

    // Background
    ctx.fillStyle = COLORS.panel.bg;
    ctx.fillRect(modalX, modalY, modalWidth, modalHeight);
    ctx.strokeStyle = COLORS.overlay.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);

    // Title
    ctx.fillStyle = COLORS.overlay.titleText;
    ctx.font = MODAL_TITLE_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.title, modalX + modalWidth / 2, modalY + 20);

    // Body
    ctx.fillStyle = COLORS.overlay.bodyText;
    ctx.font = MODAL_BODY_FONT;
    const lines = this.body.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, modalX + modalWidth / 2, modalY + 60 + i * 20);
    });

    // Buttons
    const btnWidth = 140;
    const btnHeight = 40;
    const btnY = modalY + modalHeight - 60;
    
    const cancelRect = { x: modalX + 40, y: btnY, width: btnWidth, height: btnHeight };
    this.okRect = { x: modalX + modalWidth - 40 - btnWidth, y: btnY, width: btnWidth, height: btnHeight };

    
    // We'll use doButton for Cancel to handle the click properly
    // but the OK button is custom.
    // Re-doing Cancel with doButton
    ctx.save();
    const cancelClicked = doButton(ctx, input, cancelRect, 'Cancel', {
        activeSurface: COLORS.button.secondary.surface,
        inactiveSurface: COLORS.button.secondary.surface,
        activeBorder: COLORS.button.secondary.border,
        inactiveBorder: COLORS.button.secondary.border,
        textColor: COLORS.button.secondary.text
    });
    if (cancelClicked) {
        this.onCancel();
    }
    ctx.restore();

    // OK Button with hold progress
    const isHoveringOk = pointInRect(input.pointer, this.okRect);
    const isHoldingOk = isHoveringOk && input.isPressed;
    
    const holdProgress = Math.min(1, this.holdTime / this.requiredHoldTime);
    
    const label = holdProgress > 0 
        ? `HOLD (${Math.ceil((this.requiredHoldTime - this.holdTime)/1000)}s)` 
        : 'HOLD TO RESET';
        
    drawButton(ctx, this.okRect, label, {
        active: isHoveringOk,
        activeSurface: COLORS.button.surface.active,
        inactiveSurface: COLORS.button.surface.inactive
    });

    // Draw progress bar on top of OK button
    if (holdProgress > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(this.okRect.x, this.okRect.y + this.okRect.height - 6, this.okRect.width * holdProgress, 6);
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
    private angle = 0;

    constructor(private message: string = 'Loading authoritative state...') {}

    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.angle);
        
        ctx.strokeStyle = COLORS.panel.textPrimary;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 1.5);
        ctx.stroke();
        
        ctx.restore();
        
        ctx.fillStyle = COLORS.panel.textPrimary;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.message, centerX, centerY + 60);
        
        // Non-dismissible: we don't handle onClose or any clicks here.
        input.consumed = true;
    }

    tick(dt: number, input: InteractionState) {
        this.angle += dt * 0.005;
        input.consumed = true;
    }
}
