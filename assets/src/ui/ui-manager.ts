import { ModalManager } from './modal-manager';
import { OverlayManager } from './overlay-manager';
import { InteractionState } from './interaction-manager';
import { ServerState } from '../net/snapshots';

export class UIManager {
  public readonly modalManager = new ModalManager();
  public readonly overlayManager = new OverlayManager();

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState, state: ServerState) {
    // Render order: Overlays first, Modals on top. 
    // Modals block input to lower layers.
    if (this.modalManager.isOpen()) {
      // If modal is open, it consumes interactions, preventing overlays/game from seeing them
      // We still pass input so the modal itself can be interacted with
      this.modalManager.render(ctx, canvas, input);
      input.consumed = true;
    } else {
      this.overlayManager.render(ctx, canvas, input, state);
    }
  }

  tick(dt: number, input: InteractionState) {
    this.overlayManager.tick(dt);
    this.modalManager.tick(dt, input);
  }
}

