import { ServerState } from '../../net/snapshots';
import { InteractionState } from './interactions';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export interface Overlay {
  render(canvas: HTMLCanvasElement, input: InteractionState, state: ServerState, onClose: () => void): void;
  tick(dt: number): void;
  onClose?: () => void;
}

export class Overlays {
  private activeOverlay: Overlay | null = null;

  open(overlay: Overlay) {
    this.activeOverlay = overlay;
  }

  close() {
    if (this.activeOverlay?.onClose) {
      this.activeOverlay.onClose();
    }
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

  isActive(overlay: Overlay): boolean {
    return this.activeOverlay === overlay;
  }

  getActiveOverlay(): Overlay | null {
    return this.activeOverlay;
  }

  render(canvas: HTMLCanvasElement, input: InteractionState, state: ServerState) {
    if (!this.activeOverlay) return;
    getActiveWebGLRenderer();

    // Overlays can optionally draw their own backdrop, but typically they do.
    // For now we assume the overlay handles its own background/backdrop.
    this.activeOverlay.render(canvas, input, state, () => this.close());
  }

  tick(dt: number) {
    if (this.activeOverlay) {
      this.activeOverlay.tick(dt);
    }
  }
}
