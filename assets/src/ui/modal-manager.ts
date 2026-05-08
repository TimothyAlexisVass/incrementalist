import { COLORS } from '../colors';
import { InputState } from './input';

export interface Modal {
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState): void;
  tick(dt: number, input: InputState): void;
}

export class ModalManager {
  private activeModal: Modal | null = null;

  open(modal: Modal) {
    this.activeModal = modal;
  }

  close() {
    this.activeModal = null;
  }

  isOpen(): boolean {
    return this.activeModal !== null;
  }

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState) {
    if (!this.activeModal) return;

    // Draw backdrop
    ctx.fillStyle = COLORS.overlay.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.activeModal.render(ctx, canvas, input);
  }

  tick(dt: number, input: InputState) {
    if (this.activeModal) {
      this.activeModal.tick(dt, input);
    }
  }
}
