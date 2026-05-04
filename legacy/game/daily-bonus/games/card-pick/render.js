import {
  CARD_PICK_BOARD_COLS,
  CARD_PICK_BOARD_ROWS,
  CARD_PICK_CARD_COUNT,
  CARD_PICK_SESSION_STATUS
} from './index.js';

const CARD_WIDTH = 76;
const CARD_LAYOUT_HEIGHT = 96;
const CARD_HEIGHT = CARD_LAYOUT_HEIGHT - 4;
const CARD_GAP = 8;
const BOARD_Y_OFFSET = 24;
const FALLBACK_CARD = Object.freeze({
  tier: 1,
  rarity: 'Common Card',
  rewardId: 'tier_1',
  color: '#9aa7b5',
  multiplier: 1
});

export function renderCardPickStage(ctx, layout, result, reveal, now) {
  const stageRect = getStageRect(layout);
  const boardLayout = getCardPickBoardLayout(layout);
  layout.cardPickCardRects = boardLayout.cardRects;
  layout.cardPickBoardRect = boardLayout.boardRect;

  const board = Array.isArray(result?.initialBoard)
    ? result.initialBoard
    : new Array(CARD_PICK_CARD_COUNT).fill(null);
  const selectedIndexes = Array.isArray(result?.selectedCardIndexes)
    ? result.selectedCardIndexes
    : [];

  drawProgressText(ctx, stageRect, boardLayout, result);

  for (let i = 0; i < CARD_PICK_CARD_COUNT; i += 1) {
    const cardRect = boardLayout.cardRects[i];
    const selectedOrderIndex = selectedIndexes.indexOf(i);
    const cardData = board[i] || FALLBACK_CARD;
    const isPicked = selectedOrderIndex >= 0 || Boolean(cardData.selected);
    const isRevealed = Boolean(cardData.revealed) || Boolean(result && reveal.complete);
    const isActive = Boolean(result)
      && isPicked
      && !reveal.complete
      && selectedOrderIndex === selectedIndexes.length - 1;

    drawCard(
      ctx,
      cardRect.x,
      cardRect.y,
      cardRect.width,
      cardRect.height,
      cardData,
      isRevealed,
      isPicked,
      isActive,
      reveal,
      now,
      boardLayout.scale
    );
  }
}

export function getCardPickCardIndexAtPoint(layout, x, y) {
  const cardRects = Array.isArray(layout?.cardPickCardRects)
    ? layout.cardPickCardRects
    : getCardPickBoardLayout(layout).cardRects;

  for (const cardRect of cardRects) {
    if (pointInRect(cardRect, x, y)) {
      return cardRect.cardIndex;
    }
  }

  return null;
}

export function getCardPickBoardLayout(layout) {
  const stageRect = getStageRect(layout);
  const scale = getStageScale(stageRect);
  const totalWidth = getBoardWidth() * scale;
  const layoutHeight = getBoardLayoutHeight() * scale;
  const totalHeight = getBoardHeight() * scale;
  const startX = stageRect.x + (stageRect.width - totalWidth) / 2;
  const startY = stageRect.y + (stageRect.height - layoutHeight) / 2 + (BOARD_Y_OFFSET * scale);
  const cardRects = [];

  for (let i = 0; i < CARD_PICK_CARD_COUNT; i += 1) {
    const col = i % CARD_PICK_BOARD_COLS;
    const row = Math.floor(i / CARD_PICK_BOARD_COLS);
    cardRects.push({
      cardIndex: i,
      x: startX + (col * (CARD_WIDTH + CARD_GAP)) * scale,
      y: startY + (row * (CARD_HEIGHT + CARD_GAP)) * scale,
      width: CARD_WIDTH * scale,
      height: CARD_HEIGHT * scale
    });
  }

  return {
    scale,
    startX,
    startY,
    boardRect: {
      x: startX,
      y: startY,
      width: totalWidth,
      height: totalHeight
    },
    cardRects
  };
}

function drawCard(ctx, x, y, w, h, cardData, isRevealed, isPicked, isActive, reveal, now, scale) {
  ctx.save();

  const pulse = (isActive || (isRevealed && isPicked && reveal.complete && cardData.tier >= 4))
    ? 0.5 + (Math.sin(now / 150) * 0.5)
    : 1;

  if (isRevealed) {
    if (isPicked) {
      ctx.shadowColor = cardData.color;
      ctx.shadowBlur = 14 * scale * pulse;
    }

    ctx.fillStyle = cardData.color;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.fillRect(x + (6 * scale), y + (6 * scale), w - (12 * scale), 8 * scale);

    ctx.fillStyle = '#07101d';
    ctx.font = `bold ${Math.round(16 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`T${cardData.tier}`, x + w / 2, y + h / 2 - 10 * scale);

    if (cardData.multiplier && cardData.multiplier > 1) {
      ctx.font = `bold ${Math.round(12 * scale)}px Arial`;
      ctx.fillStyle = '#ffbe4d';
      ctx.fillText(`x${cardData.multiplier}`, x + w / 2, y + h / 2 + 15 * scale);
    }

    if (!isPicked) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, w, h);
    }

    ctx.strokeStyle = isPicked ? '#f7fbff' : 'rgba(8, 12, 20, 0.75)';
    ctx.lineWidth = (isPicked ? 2.5 : 1.5) * scale;
    ctx.strokeRect(x + (1 * scale), y + (1 * scale), w - (2 * scale), h - (2 * scale));
  } else {
    if (isPicked) {
      ctx.shadowColor = '#f7fbff';
      ctx.shadowBlur = 10 * scale * pulse;
    }

    ctx.fillStyle = '#263246';
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#1a2434';
    ctx.fillRect(x + (8 * scale), y + (8 * scale), w - (16 * scale), h - (16 * scale));

    ctx.strokeStyle = isPicked ? '#f7fbff' : '#5f708a';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(x + (4 * scale), y + (4 * scale), w - (8 * scale), h - (8 * scale));

    ctx.fillStyle = '#9dadc2';
    ctx.font = `bold ${Math.round(20 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x + w / 2, y + h / 2 - (cardData.multiplier > 1 ? 8 * scale : 0));

    if (cardData.multiplier && cardData.multiplier > 1) {
      ctx.fillStyle = '#ffbe4d';
      ctx.font = `bold ${Math.round(12 * scale)}px Arial`;
      ctx.fillText(`x${cardData.multiplier}`, x + w / 2, y + h / 2 + 18 * scale);
    }
  }

  ctx.restore();
}

function drawProgressText(ctx, stageRect, boardLayout, result) {
  if (!ctx) {
    return;
  }

  const phase = Array.isArray(result?.phases)
    ? result.phases[Math.max(0, Number(result.currentPhaseIndex) || 0)]
    : null;
  const selectedCount = Array.isArray(result?.selectedCardIndexes)
    ? result.selectedCardIndexes.length
    : Array.isArray(phase?.selectedCardIndexes)
      ? phase.selectedCardIndexes.length
      : 0;
  const phaseSelectedCount = Array.isArray(phase?.selectedCardIndexes)
    ? phase.selectedCardIndexes.length
    : 0;
  const pickCount = Math.max(0, Number(phase?.pickCount) || Number(result?.requiredPickCount) || 0);
  const picksRemaining = Math.max(0, pickCount - phaseSelectedCount);
  let text = 'Pick Cards to begin';

  if (result?.status === CARD_PICK_SESSION_STATUS.SELECTING && pickCount > 0) {
    text = picksRemaining === 1
      ? '1 pick left'
      : `${picksRemaining} picks left`;
  } else if (result?.status === CARD_PICK_SESSION_STATUS.SELECTED_REVEALED) {
    text = 'Revealing missed cards';
  } else if (
    result?.status === CARD_PICK_SESSION_STATUS.MISSED_REVEALED
    || result?.status === CARD_PICK_SESSION_STATUS.COMPLETE
    || result?.action === 'card_pick_complete'
  ) {
    text = `${selectedCount} card${selectedCount === 1 ? '' : 's'} collected`;
  }

  ctx.save();
  ctx.fillStyle = '#d8e6f7';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, stageRect.x + stageRect.width / 2, Math.max(stageRect.y + 12, boardLayout.startY - 18));
  ctx.restore();
}

function getStageRect(layout) {
  return layout.stageRect || {
    x: 80,
    y: 142,
    width: 1120,
    height: 526
  };
}

function getStageScale(stageRect) {
  return Math.max(0.35, Math.min(stageRect.width / getBoardWidth(), stageRect.height / getBoardLayoutHeight(), 1.12));
}

function getBoardWidth() {
  return CARD_PICK_BOARD_COLS * CARD_WIDTH + (CARD_PICK_BOARD_COLS - 1) * CARD_GAP;
}

function getBoardHeight() {
  return CARD_PICK_BOARD_ROWS * CARD_HEIGHT + (CARD_PICK_BOARD_ROWS - 1) * CARD_GAP;
}

function getBoardLayoutHeight() {
  return CARD_PICK_BOARD_ROWS * CARD_LAYOUT_HEIGHT + (CARD_PICK_BOARD_ROWS - 1) * CARD_GAP;
}

function pointInRect(rect, x, y) {
  return Boolean(rect)
    && x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}
