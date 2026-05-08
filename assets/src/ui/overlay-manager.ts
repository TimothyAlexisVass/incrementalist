import { ServerState } from '../net/snapshots';

export interface Overlay {
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState, state: ServerState, onClose: () => void): void;
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

  getActiveOverlay(): Overlay | null {
    return this.activeOverlay;
  }

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState, state: ServerState) {
    if (!this.activeOverlay) return;

    // Overlays can optionally draw their own backdrop, but typically they do.
    // For now we assume the overlay handles its own background/backdrop.
    this.activeOverlay.render(ctx, canvas, input, state, () => this.close());
  }

  tick(dt: number) {
    if (this.activeOverlay) {
      this.activeOverlay.tick(dt);
    }
  }
}
