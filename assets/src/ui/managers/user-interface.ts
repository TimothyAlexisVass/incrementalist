import { Modals } from './modals';
import { Overlays } from './overlays';
import { InteractionState, pointInRect } from './interactions';
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
    const modalMaskRect = modal?.getInteractionMaskRect?.(canvas) ?? null;
    const pointerOverModalMask = modalMaskRect
      ? pointInRect(input.pointer, modalMaskRect) || pointInRect(input.pressStartPointer, modalMaskRect)
      : false;
    const isBlocking = modal?.isBlocking ?? false;

    // Render overlays first (behind modals).
    // Block overlays if the active modal is fully blocking, or if pointer is
    // currently over a non-blocking modal's interaction mask.
    const overlayInput = (isBlocking || pointerOverModalMask)
      ? { ...input, pointer: null, pressStartPointer: null, clicked: false, isPressed: false, consumed: true }
      : input;
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
