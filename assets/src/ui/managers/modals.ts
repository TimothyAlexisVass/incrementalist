import { COLORS } from '../../colors';
import { InteractionState } from './interactions';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export interface Modal {
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState): void;
  tick(dt: number, input: InteractionState): void;
}

export class Modals {
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

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState) {
    if (!this.activeModal) return;

    const renderer = getActiveWebGLRenderer();
    if (!renderer) return;

    renderer.drawRect({
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
      color: cssToRgba(COLORS.overlay.backdrop)
    });

    this.activeModal.render(ctx, canvas, input);
  }

  tick(dt: number, input: InteractionState) {
    if (this.activeModal) {
      this.activeModal.tick(dt, input);
    }
  }
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || "").trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}
