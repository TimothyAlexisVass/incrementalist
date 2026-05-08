import { COLORS } from '../../../colors';
import { SAVE_AUTOSAVE_FONT } from '../../../config';
import { InputState } from '../../input';
import { ServerState } from '../../../net/snapshots';
import { Rect } from '../../components/tab-menu/tab-menu';
import { drawSaveSlotCard, SaveSlotActions } from '../../components/cards/save-slot';

export function renderSaveFilesTab(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  input: InputState,
  state: ServerState,
  rect: Rect,
  actions: SaveSlotActions
) {
  const slots = state.slots;
  if (slots.length === 0) {
    ctx.fillStyle = COLORS.panel.textPrimary;
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Loading save files...', rect.x + rect.width / 2, rect.y + rect.height / 2);
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
      drawSaveSlotCard(ctx, input, slotRect, slot, actions);
    } else {
      // Draw as empty slot if server hasn't provided data for this index yet
      drawSaveSlotCard(ctx, input, slotRect, {
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
  ctx.fillStyle = COLORS.overlay.bodyText;
  ctx.font = SAVE_AUTOSAVE_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    'Progress is autosaved continuously.', 
    rect.x + 24, 
    rect.y + rect.height - 24
  );
}
