import { ModalManager } from './components/modal-manager';
import { OverlayManager } from './components/overlay-manager';

export class UIManager {
  public readonly modalManager = new ModalManager();
  public readonly overlayManager = new OverlayManager();

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    // Render order: Overlays first, Modals on top
    this.overlayManager.render(ctx, canvas);
    this.modalManager.render(ctx, canvas);
  }

  handleInput(event: Event, point: { x: number; y: number } | null): boolean {
    // Input priority: Modals > Overlays
    if (this.modalManager.handleInput(event, point)) {
      return true;
    }
    if (this.overlayManager.handleInput(event, point)) {
      return true;
    }
    return false;
  }
  
  tick(dt: number) {
    this.overlayManager.tick(dt);
    this.modalManager.tick(dt);
  }
}
