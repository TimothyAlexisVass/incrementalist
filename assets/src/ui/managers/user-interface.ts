import { Modals } from './modals';
import { Overlays } from './overlays';
import { InteractionState } from './interactions';
import { ServerState } from '../../net/snapshots';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export class UserInterface {
  public readonly modals = new Modals();
  public readonly overlays = new Overlays();

  closeAll() {
    this.modals.close();
    this.overlays.close();
  }

  render(canvas: HTMLCanvasElement, input: InteractionState, state: ServerState) {
    getActiveWebGLRenderer();

    const modal = this.modals.getActiveModal();
    const isBlocking = modal?.isBlocking ?? false;

    // Render overlays first (behind modals).
    // If a blocking modal is open, we pass a "swallowed" input to overlays 
    // so they stay visible but don't respond to clicks.
    const overlayInput = isBlocking ? { ...input, clicked: false, isPressed: false, consumed: true } : input;
    this.overlays.render(canvas, overlayInput, state);

    if (this.modals.isOpen()) {
      this.modals.render(canvas, input);
      if (isBlocking) {
        input.consumed = true;
      }
    }
  }

  tick(dt: number, input: InteractionState) {
    this.overlays.tick(dt);
    this.modals.tick(dt, input);
  }
}
