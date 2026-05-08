import { ModalManager } from './components/modal-manager';
import { OverlayManager } from './components/overlay-manager';
import { InputState } from './input';

export class UIManager {
  public readonly modalManager = new ModalManager();
  public readonly overlayManager = new OverlayManager();

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState) {
    // Render order: Overlays first, Modals on top. 
    // Modals block input to lower layers.
    if (this.modalManager.isOpen()) {
      // If modal is open, it consumes interactions, preventing overlays/game from seeing them
      // We still pass input so the modal itself can be interacted with
      this.modalManager.render(ctx, canvas, input);
      input.consumed = true;
    } else {
      this.overlayManager.render(ctx, canvas, input);
    }
  }

  tick(dt: number) {
    this.overlayManager.tick(dt);
    this.modalManager.tick(dt);
  }
}

