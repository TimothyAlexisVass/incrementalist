import { MAX_SAVEFILES } from '../config.js';
import { COLORS } from '../colors.js';
import { drawButton } from '../ui/components.js';
import { formatFileLabel, formatLevel, formatNumber, formatTimestamp, toFiniteNumber } from '../format.js';
import {
  SAVE_AUTOSAVE_FONT,
  SAVE_FILE_LABEL_FONT,
  SAVE_FILE_INFO_FONT,
  SAVE_FILE_STATUS_FONT,
  SAVE_DELETE_FONT,
} from '../config.js';

export function renderSavePanel(ctx, overlayRect, savePanelState) {
  const slotInfo = Array.isArray(savePanelState?.slots) ? savePanelState.slots : [];

  const fallbackSlotInfo = [
    { fileIndex: 0, hasData: false, isCurrent: true, level: 1, rewardsClaimed: 0, savedAt: 0 },
    { fileIndex: 1, hasData: false, isCurrent: false, level: 1, rewardsClaimed: 0, savedAt: 0 },
    { fileIndex: 2, hasData: false, isCurrent: false, level: 1, rewardsClaimed: 0, savedAt: 0 },
    { fileIndex: 3, hasData: false, isCurrent: false, level: 1, rewardsClaimed: 0, savedAt: 0 }
  ];
  const slots = slotInfo.length > 0 ? slotInfo : fallbackSlotInfo;

  const slotWidth = 250;
  const slotHeight = 210;
  const slotGap = 28;
  const totalWidth = (slotWidth * slots.length) + (slotGap * (slots.length - 1));
  const slotStartX = overlayRect.x + Math.floor((overlayRect.width - totalWidth) / 2);
  const totalHeight = slotHeight;
  const slotY = overlayRect.y + Math.floor((overlayRect.height - totalHeight) / 2);
  const saveFileRects = [];
  const resetButtonRects = [];

  ctx.fillStyle = COLORS.overlay.bodyText;
  ctx.font = SAVE_AUTOSAVE_FONT;
  ctx.textAlign = 'left';
  ctx.fillText('Progress is autosaved continuously.', overlayRect.x + 24, overlayRect.y + overlayRect.height - 24);

  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const rect = {
      x: slotStartX + (i * (slotWidth + slotGap)),
      y: slotY,
      width: slotWidth,
      height: slotHeight,
      fileIndex: slot.fileIndex
    };
    saveFileRects.push(rect);

    const isCurrent = Boolean(slot.isCurrent);
    ctx.fillStyle = isCurrent ? COLORS.button.surface.active : COLORS.button.surface.inactive;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = isCurrent ? COLORS.button.border.active : COLORS.button.border.inactive;
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    ctx.fillStyle = COLORS.button.text;
    ctx.font = SAVE_FILE_LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.fillText(formatFileLabel(slot.fileIndex), rect.x + (rect.width / 2), rect.y + 34);

    ctx.font = SAVE_FILE_INFO_FONT;
    ctx.fillText(slot.hasData ? formatLevel(slot.level) : 'Empty Slot', rect.x + (rect.width / 2), rect.y + 62);
    ctx.fillText(
      slot.hasData ? `Rewards Claimed: ${formatNumber(Math.max(0, toFiniteNumber(slot.rewardsClaimed, 0)))}` : `Rewards Claimed: ${formatNumber(0)}`,
      rect.x + (rect.width / 2),
      rect.y + 86
    );
    ctx.fillText(
      slot.hasData ? `Saved: ${formatTimestamp(slot.savedAt)}` : 'Saved: Never',
      rect.x + (rect.width / 2),
      rect.y + 110
    );

    ctx.fillStyle = isCurrent ? COLORS.overlay.questProgressReadyText : COLORS.button.text;
    ctx.font = SAVE_FILE_STATUS_FONT;
    ctx.fillText(
      isCurrent ? 'Active File' : 'Click To Switch',
      rect.x + (rect.width / 2),
      rect.y + rect.height - 22
    );

    if (slot.hasData && isCurrent) {
      const deleteRect = {
        x: rect.x + (rect.width / 2) - 35,
        y: rect.y + rect.height + 8,
        width: 70,
        height: 22,
        fileIndex: slot.fileIndex
      };
      ctx.fillStyle = COLORS.button.secondary.surface;
      ctx.fillRect(deleteRect.x, deleteRect.y, deleteRect.width, deleteRect.height);
      ctx.strokeStyle = COLORS.button.secondary.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(deleteRect.x, deleteRect.y, deleteRect.width, deleteRect.height);
      ctx.fillStyle = COLORS.button.secondary.text;
      ctx.font = SAVE_DELETE_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('DELETE', deleteRect.x + (deleteRect.width / 2), deleteRect.y + 15);
      resetButtonRects.push(deleteRect);
    }
  }

  return {
    saveFileRects,
    resetButtonRects
  };
}
