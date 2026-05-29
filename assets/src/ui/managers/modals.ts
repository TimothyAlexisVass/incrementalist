import { COLORS } from '../../colors';
import { InteractionState } from './interactions';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export interface Modal {
  render(canvas: HTMLCanvasElement, input: InteractionState): void;
  tick(dt: number, input: InteractionState): void;
  isBlocking: boolean;
  backdropAlpha?: number;
  closeOnMenuButton?: boolean;
  closeOnOutsideClick?: boolean;
  getInteractionMaskRect?: (canvas: HTMLCanvasElement) => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export class Modals {
  private activeModal: Modal | null = null;

  open(modal: Modal) {
    this.activeModal = modal;
  }

  close() {
    this.activeModal = null;
  }

  getActiveModal(): Modal | null {
    return this.activeModal;
  }

  isOpen(): boolean {
    return this.activeModal !== null;
  }

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    if (!this.activeModal) return;

    const renderer = getActiveWebGLRenderer();

    const alpha = this.activeModal.isBlocking ? 0.4 : 0;

    renderer.drawRect({
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      color: [COLORS.overlay.backdrop[0], COLORS.overlay.backdrop[1], COLORS.overlay.backdrop[2], alpha]
    });

    this.activeModal.render(canvas, input);
  }

  tick(dt: number, input: InteractionState) {
    if (this.activeModal) {
      this.activeModal.tick(dt, input);
    }
  }
}


