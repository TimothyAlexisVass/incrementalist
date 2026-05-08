import { InputState } from './input';

export interface Overlay {
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState, onClose: () => void): void;
  tick(dt: number): void;
}

export class OverlayManager {
  private activeOverlay: Overlay | null = null;

  open(overlay: Overlay) {
    this.activeOverlay = overlay;
  }

  close() {
    this.activeOverlay = null;
  }
  
  toggle(overlay: Overlay) {
    if (this.activeOverlay === overlay) {
      this.close();
    } else {
      this.open(overlay);
    }
  }

  isOpen(): boolean {
    return this.activeOverlay !== null;
  }

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState) {
    if (!this.activeOverlay) return;

    // Overlays can optionally draw their own backdrop, but typically they do.
    // For now we assume the overlay handles its own background/backdrop.
    this.activeOverlay.render(ctx, canvas, input, () => this.close());
  }

  tick(dt: number) {
    if (this.activeOverlay) {
      this.activeOverlay.tick(dt);
    }
  }
}
