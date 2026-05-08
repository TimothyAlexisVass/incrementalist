import { Overlay } from '../overlay-manager';
import { COLORS } from '../../colors';
import { InputState, pointInRect } from '../input';
import {
  TOP_HUD_HEIGHT,
  BOTTOM_HUD_HEIGHT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_WIDTH,
} from '../../config';

export class MenuShell implements Overlay {
  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState, onClose: () => void) {
    ctx.save();

    // Cover only the display area — leaves the top HUD, bottom HUD, and
    // the right-hand progress bar column completely untouched.
    const x = DISPLAY_AREA_X;
    const y = TOP_HUD_HEIGHT;
    const width = DISPLAY_AREA_WIDTH;
    const height = canvas.height - TOP_HUD_HEIGHT - BOTTOM_HUD_HEIGHT;
    const shellRect = { x, y, width, height };

    ctx.fillStyle = COLORS.panel.bg;
    ctx.fillRect(x, y, width, height);

    // Placeholder Title
    ctx.fillStyle = COLORS.overlay.titleText;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Menu Placeholder', x + 20, y + 20);

    // Placeholder Close Text
    ctx.fillStyle = COLORS.button.text;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('[ESC] or click outside to close', x + width - 20, y + 24);

    ctx.restore();

    // Consume input inside the overlay. Clicks outside close it.
    if (!input.consumed) {
      if (pointInRect(input.pointer, shellRect)) {
        input.consumed = true;
      } else if (input.clicked) {
        onClose();
      }
    }
  }

  tick(dt: number) { }
}
