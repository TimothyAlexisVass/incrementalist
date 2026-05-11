import { COLORS } from '../../../../colors';
import { SAVE_AUTOSAVE_FONT } from '../../../../config';
import { InteractionState } from '../../../managers/interactions';
import { ServerState } from '../../../../net/snapshots';
import { Rect } from '../../../components/tab-menu/tab-menu';
import { drawSaveSlotCard, SaveSlotActions } from '../../../components/cards/save-slot';

import { getActiveWebGLRenderer } from '../../../../renderer/webgl';

export function renderSaveFilesTab(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState,
  rect: Rect,
  actions: SaveSlotActions
) {
  const slots = state.slots;
  if (slots.length === 0) {
    const renderer = getActiveWebGLRenderer();
    if (renderer) {
      renderer.drawText({
        text: 'Loading save files...',
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        font: '18px Arial',
        color: COLORS.panel.textPrimary,
        align: 'center',
        baseline: 'middle'
      });
    }
    return;
  }

  const slotWidth = 250;
  const slotHeight = 210;
  const slotGap = 28;
  const maxSlots = 4;
  const totalWidth = (slotWidth * maxSlots) + (slotGap * (maxSlots - 1));
  const slotStartX = rect.x + Math.floor((rect.width - totalWidth) / 2);
  const totalHeight = slotHeight;
  const slotY = rect.y + Math.floor((rect.height - totalHeight) / 2) - 20;

  for (let i = 0; i < maxSlots; i++) {
    const slot = slots.find(s => s.slot_index === i);
    const slotRect = {
      x: slotStartX + (i * (slotWidth + slotGap)),
      y: slotY,
      width: slotWidth,
      height: slotHeight
    };

    if (slot) {
      drawSaveSlotCard(input, slotRect, slot, actions);
    } else {
      // Draw as empty slot if server hasn't provided data for this index yet
      drawSaveSlotCard(input, slotRect, {
        slot_index: i,
        file_index: i,
        is_current: false,
        has_data: false,
        level: 1,
        rewards_claimed: 0,
        saved_at: ''
      }, actions);
    }
  }

  // Footer text
  const renderer = getActiveWebGLRenderer();
  if (renderer) {
    renderer.drawText({
      text: 'Progress is autosaved continuously.',
      x: rect.x + 24,
      y: rect.y + rect.height - 24,
      font: SAVE_AUTOSAVE_FONT,
      color: COLORS.overlay.bodyText,
      align: 'left',
      baseline: 'bottom'
    });
  }
}
