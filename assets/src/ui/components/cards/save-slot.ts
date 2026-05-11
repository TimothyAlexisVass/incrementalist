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
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

export interface SaveSlotActions {
  onSwitch: (index: number) => void;
  onReset: (index: number) => void;
}

export function drawSaveSlotCard(
  input: InteractionState,
  rect: Rect,
  slot: SaveSlotSummary,
  actions: SaveSlotActions
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) {
    return;
  }

  const isCurrent = slot.is_current;
  
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: cssToRgba(isCurrent ? COLORS.button.surface.active : COLORS.button.surface.inactive)
  });
  drawRectOutline(
    renderer,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    2,
    cssToRgba(isCurrent ? COLORS.button.border.active : COLORS.button.border.inactive)
  );
  renderer.drawText({
    text: formatFileLabel(slot.file_index),
    x: rect.x + rect.width / 2,
    y: rect.y + 20,
    font: SAVE_FILE_LABEL_FONT,
    color: COLORS.button.text,
    align: 'center',
    baseline: 'top'
  });

  // Stats
  const statsY = rect.y + 60;
  const lineGap = 24;
  renderer.drawText({
    text: slot.has_data ? formatLevel(slot.level) : 'Empty Slot',
    x: rect.x + rect.width / 2,
    y: statsY,
    font: SAVE_FILE_INFO_FONT,
    color: COLORS.button.text,
    align: 'center',
    baseline: 'top'
  });
  renderer.drawText({
    text: slot.has_data ? `Rewards Claimed: ${formatNumber(slot.rewards_claimed)}` : 'Rewards Claimed: 0',
    x: rect.x + rect.width / 2,
    y: statsY + lineGap,
    font: SAVE_FILE_INFO_FONT,
    color: COLORS.button.text,
    align: 'center',
    baseline: 'top'
  });
  
  // Convert ISO string or timestamp to displayable time
  const savedAtVal = slot.saved_at ? new Date(slot.saved_at).getTime() : 0;
  renderer.drawText({
    text: slot.has_data ? `Saved: ${formatTimestamp(savedAtVal)}` : 'Saved: Never',
    x: rect.x + rect.width / 2,
    y: statsY + lineGap * 2,
    font: SAVE_FILE_INFO_FONT,
    color: COLORS.button.text,
    align: 'center',
    baseline: 'top'
  });

  // Status / Switch Action
  const statusY = rect.y + rect.height - 25;
  
  if (isCurrent) {
    renderer.drawText({
      text: 'Active File',
      x: rect.x + rect.width / 2,
      y: statusY,
      font: SAVE_FILE_STATUS_FONT,
      color: COLORS.overlay.statusUnlocked,
      align: 'center',
      baseline: 'top'
    });
  } else {
    // Switch Button
    const btnWidth = 140;
    const btnHeight = 28;
    const switchClicked = doButton(
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
    
    if (doButton(input, deleteRect, 'DELETE', {
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

function drawRectOutline(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  y: number,
  width: number,
  height: number,
  lineWidth: number,
  color: [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(lineWidth) ? lineWidth : 1);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}

function cssToRgba(color: string): [number, number, number, number] {
  const normalized = String(color || '').trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) return [1, 1, 1, 1];
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
}
