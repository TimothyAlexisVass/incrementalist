import { COLORS } from '../../../colors';
import { 
  SAVE_FILE_LABEL_FONT, 
  SAVE_FILE_INFO_FONT, 
  SAVE_FILE_STATUS_FONT,
  SAVE_DELETE_FONT
} from '../../../config';
import { 
  formatFileLabel, 
  formatLevel, 
  formatNumber, 
  formatTimestamp 
} from '../../../utils';
import { InteractionState } from '../../managers/interactions';
import { doButton } from '../button';
import { Rect } from '../tab-menu/tab-menu';
import type { SaveSlotSummary } from '../../../net/protocol';

export interface SaveSlotActions {
  onSwitch: (index: number) => void;
  onReset: (index: number) => void;
}

export function drawSaveSlotCard(
  ctx: CanvasRenderingContext2D,
  input: InteractionState,
  rect: Rect,
  slot: SaveSlotSummary,
  actions: SaveSlotActions
) {
  const isCurrent = slot.is_current;
  
  // Background
  ctx.fillStyle = isCurrent ? COLORS.button.surface.active : COLORS.button.surface.inactive;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  
  // Border
  ctx.strokeStyle = isCurrent ? COLORS.button.border.active : COLORS.button.border.inactive;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  // Label (File X)
  ctx.fillStyle = COLORS.button.text;
  ctx.font = SAVE_FILE_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(formatFileLabel(slot.file_index), rect.x + rect.width / 2, rect.y + 20);

  // Stats
  ctx.font = SAVE_FILE_INFO_FONT;
  const statsY = rect.y + 60;
  const lineGap = 24;
  
  ctx.fillText(slot.has_data ? formatLevel(slot.level) : 'Empty Slot', rect.x + rect.width / 2, statsY);
  ctx.fillText(
    slot.has_data ? `Rewards Claimed: ${formatNumber(slot.rewards_claimed)}` : 'Rewards Claimed: 0',
    rect.x + rect.width / 2,
    statsY + lineGap
  );
  
  // Convert ISO string or timestamp to displayable time
  const savedAtVal = slot.saved_at ? new Date(slot.saved_at).getTime() : 0;
  ctx.fillText(
    slot.has_data ? `Saved: ${formatTimestamp(savedAtVal)}` : 'Saved: Never',
    rect.x + rect.width / 2,
    statsY + lineGap * 2
  );

  // Status / Switch Action
  ctx.fillStyle = isCurrent ? COLORS.overlay.statusUnlocked : COLORS.button.text;
  ctx.font = SAVE_FILE_STATUS_FONT;
  const statusY = rect.y + rect.height - 25;
  
  if (isCurrent) {
    ctx.fillText('Active File', rect.x + rect.width / 2, statusY);
  } else {
    // Switch Button
    const btnWidth = 140;
    const btnHeight = 28;
    const switchClicked = doButton(
        ctx, 
        input, 
        { 
            x: rect.x + (rect.width - btnWidth) / 2, 
            y: statusY - 14, 
            width: btnWidth, 
            height: btnHeight 
        }, 
        'Switch',
        { font: SAVE_FILE_STATUS_FONT }
    );
    if (switchClicked) {
        actions.onSwitch(slot.slot_index);
    }
  }

  // Delete/Reset Action (only for current slot if it has data)
  if (slot.has_data && isCurrent) {
    const deleteBtnWidth = 70;
    const deleteBtnHeight = 22;
    const deleteRect = {
      x: rect.x + (rect.width - deleteBtnWidth) / 2,
      y: rect.y + rect.height + 8,
      width: deleteBtnWidth,
      height: deleteBtnHeight
    };
    
    if (doButton(ctx, input, deleteRect, 'DELETE', {
        font: SAVE_DELETE_FONT,
        activeSurface: COLORS.button.secondary.surface,
        inactiveSurface: COLORS.button.secondary.surface,
        activeBorder: COLORS.button.secondary.border,
        inactiveBorder: COLORS.button.secondary.border,
        textColor: COLORS.button.secondary.text
    })) {
        actions.onReset(slot.slot_index);
    }
  }
}
