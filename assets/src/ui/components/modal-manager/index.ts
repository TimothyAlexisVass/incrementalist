import { COLORS } from '../../../colors';

export interface Modal {
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void;
  handleInput(event: Event, point: { x: number; y: number } | null): boolean;
  tick(dt: number): void;
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

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    if (!this.activeModal) return;

    // Draw backdrop
    ctx.fillStyle = COLORS.overlay.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.activeModal.render(ctx, canvas);
  }

  handleInput(event: Event, point: { x: number; y: number } | null): boolean {
    if (!this.activeModal) return false;
    
    // The active modal gets the input. Even if it doesn't do anything with it,
    // it consumes it to prevent clicking through the modal.
    this.activeModal.handleInput(event, point);
    return true; 
  }

  tick(dt: number) {
    if (this.activeModal) {
      this.activeModal.tick(dt);
    }
  }
}
