import { Modals } from './modals';
import { Overlays } from './overlays';
import { InteractionState } from './interactions';
import { ServerState } from '../../net/snapshots';
import { getActiveWebGLRenderer } from '../../renderer/webgl';

export class UserInterface {
  public readonly modals = new Modals();
  public readonly overlays = new Overlays();

  render(canvas: HTMLCanvasElement, input: InteractionState, state: ServerState) {
    if (!getActiveWebGLRenderer()) return;

    // Render order: Overlays first, Modals on top. 
    // Modals block input to lower layers.
    if (this.modals.isOpen()) {
      this.modals.render(canvas, input);
      input.consumed = true;
    } else {
      this.overlays.render(canvas, input, state);
    }
  }

  tick(dt: number, input: InteractionState) {
    this.overlays.tick(dt);
    this.modals.tick(dt, input);
  }
}
