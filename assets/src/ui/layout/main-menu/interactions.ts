import { InteractionState, pointInRect } from '../../interaction-manager';
import { Rect } from '../../components/tab-menu/tab-menu';

export function handleMainMenuInteractions(input: InteractionState, shellRect: Rect, onClose: () => void) {
  if (input.consumed) return;

  if (pointInRect(input.pointer, shellRect)) {
    input.consumed = true;
  } else if (input.clicked) {
    onClose();
  }
}
