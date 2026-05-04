import { formatInteger } from '../../../format.js';
import {
  RESOURCE_CHECKLIST_GAME,
  getChecklistGameById
} from './index.js';

const CHECKLIST_COLUMNS = 3;
const CHECKLIST_ROWS = 5;
const CHECKBOX_SIZE = 18;

export function renderChecklistStage(ctx, layout, uiState, result, reveal, now) {
  const game = getDisplayGame(uiState, result);
  const rect = layout.checklistRect;
  const display = getDisplayState(uiState, result, reveal);
  const pulse = 0.55 + (Math.sin(now / 140) * 0.45);

  ctx.fillStyle = 'rgba(9, 16, 30, 0.5)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = 'rgba(142, 213, 255, 0.26)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  for (const entry of game.entries) {
    drawChecklistEntry(ctx, rect, entry, display, pulse);
  }
}

function drawChecklistEntry(ctx, rect, entry, display, pulse) {
  const gapX = 12;
  const gapY = 12;
  const cardWidth = (rect.width - 28 - ((CHECKLIST_COLUMNS - 1) * gapX)) / CHECKLIST_COLUMNS;
  const cardHeight = (rect.height - 28 - ((CHECKLIST_ROWS - 1) * gapY)) / CHECKLIST_ROWS;
  const scale = Math.max(1, Math.min(cardWidth / 180, cardHeight / 62, 1.55));
  const checkboxSize = CHECKBOX_SIZE * scale;
  const column = entry.entryIndex % CHECKLIST_COLUMNS;
  const row = Math.floor(entry.entryIndex / CHECKLIST_COLUMNS);
  const x = rect.x + 14 + (column * (cardWidth + gapX));
  const y = rect.y + 14 + (row * (cardHeight + gapY));
  const contentX = x + (14 * scale);
  const contentY = y + (14 * scale);
  const textX = contentX + checkboxSize + (14 * scale);
  const completed = entry.entryNumber <= display.completedCount;
  const active = entry.entryNumber === display.activeEntryNumber;
  const justCompleted = active && display.resultActive && display.complete;

  if (completed) {
    ctx.fillStyle = justCompleted ? 'rgba(46, 104, 78, 0.88)' : 'rgba(35, 85, 64, 0.72)';
  } else if (active) {
    ctx.fillStyle = `rgba(43, 93, 130, ${0.62 + (pulse * 0.16)})`;
  } else {
    ctx.fillStyle = 'rgba(27, 36, 53, 0.72)';
  }
  ctx.fillRect(x, y, cardWidth, cardHeight);

  ctx.strokeStyle = completed
    ? '#8ce8b5'
    : active
      ? '#8ed5ff'
      : 'rgba(111, 132, 166, 0.6)';
  ctx.lineWidth = active ? 2 * scale : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, cardWidth - 1, cardHeight - 1);

  drawEntryCheckbox(
    ctx,
    contentX,
    contentY,
    checkboxSize,
    completed,
    active && display.resultActive ? display.checkProgress : 0
  );

  ctx.fillStyle = completed ? '#f6fff9' : active ? '#f7fbff' : '#aebfd8';
  ctx.font = `bold ${Math.round(15 * scale)}px Arial`;
  ctx.textAlign = 'left';
  ctx.fillText(`Entry ${formatInteger(entry.entryNumber)}`, textX, y + (32 * scale));

  ctx.fillStyle = entry.color;
  ctx.font = `bold ${Math.round(12 * scale)}px Arial`;
  ctx.fillText(entry.rewardId, textX, y + (56 * scale));
}

function drawEntryCheckbox(ctx, x, y, size, checked, progress) {
  ctx.fillStyle = checked ? '#1d5a40' : '#162034';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = checked ? '#8ce8b5' : '#6f84a6';
  ctx.lineWidth = Math.max(1.5, size / 12);
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

  if (!checked && progress <= 0) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size * Math.max(0, Math.min(progress || 1, 1)), size);
  ctx.clip();
  ctx.strokeStyle = '#f6fff9';
  ctx.lineWidth = Math.max(2.5, size / 7);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + (size * 0.22), y + (size * 0.56));
  ctx.lineTo(x + (size * 0.44), y + (size * 0.78));
  ctx.lineTo(x + (size * 0.83), y + (size * 0.28));
  ctx.stroke();
  ctx.restore();
}

function getDisplayState(uiState, result, reveal) {
  if (!result) {
    const progress = uiState.checklist;
    return {
      completedCount: progress.completedCount,
      activeEntryNumber: progress.nextEntry.entryNumber,
      checkProgress: 0,
      resultActive: false,
      complete: false
    };
  }

  return {
    completedCount: reveal.complete ? result.completedCountAfter : result.completedCountBefore,
    activeEntryNumber: result.entryNumber,
    checkProgress: reveal.checkProgress || 0,
    resultActive: true,
    complete: reveal.complete
  };
}

function getDisplayGame(uiState, result) {
  return getChecklistGameById(result?.gameId || uiState.gameId) || RESOURCE_CHECKLIST_GAME;
}
