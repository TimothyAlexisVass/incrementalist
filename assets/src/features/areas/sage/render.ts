import { SAGE_TIPS } from './tips';
import {
  BOTTOM_HUD_HEIGHT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y,
  DISPLAY_AREA_WIDTH,
  SMALL_TEXT_FONT,
  BOTTOM_HUD_BUTTON_FONT
} from '../../../config';
import { InteractionState } from '../../../ui/managers/interactions';
import { GameChannel } from '../../../net/game-channel';
import { notices } from '../../../ui/managers/notices';
import { COLORS } from '../../../colors';
import { doButton } from '../../../ui/components/button';

const LETTERS_PER_SECOND = 40;
const PANEL_PADDING = 16;
const PANEL_GAP = 12;
const LINE_HEIGHT = 20;
const BUTTON_HEIGHT = 30;
const BUTTON_MIN_WIDTH = 88;
const BUTTON_INNER_PADDING = 14;

const tipRevealStarts = new Map<number, number>();

type SageTipRender = {
  leafId: string;
  buttonLabel: string;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  visibleLines: string[];
  buttonRect: { x: number; y: number; width: number; height: number };
};

export function renderSageArea(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  input: InteractionState,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const visibleTipLevels = getVisibleTipLevels(level);
  const visibleLevelSet = new Set(visibleTipLevels);

  for (const tipLevel of Array.from(tipRevealStarts.keys())) {
    if (!visibleLevelSet.has(tipLevel)) {
      tipRevealStarts.delete(tipLevel);
    }
  }

  if (visibleTipLevels.length === 0) {
    return;
  }

  const now = performance.now();
  const bottomHudY = canvas.height - BOTTOM_HUD_HEIGHT;
  const maxBoxWidth = DISPLAY_AREA_WIDTH - 40;

  ctx.save();
  ctx.font = SMALL_TEXT_FONT;

  const tipsToRender = visibleTipLevels.map((tipLevel) => {
    const tip = SAGE_TIPS[tipLevel];
    const leafId = tipLeafId(tipLevel);
    const buttonLabel = tip.confirmation || 'Alright';
    const fullLines = tip.text;
    const maxLineWidth = fullLines.reduce((maxWidth, line) => {
      const lineWidth = ctx.measureText(line).width;
      return Math.max(maxWidth, lineWidth);
    }, 0);

    ctx.font = BOTTOM_HUD_BUTTON_FONT;
    const buttonWidth = Math.max(
      BUTTON_MIN_WIDTH,
      Math.ceil(ctx.measureText(buttonLabel).width + BUTTON_INNER_PADDING * 2)
    );
    ctx.font = SMALL_TEXT_FONT;

    const boxWidth = Math.min(
      Math.max(maxLineWidth + PANEL_PADDING * 2, buttonWidth + PANEL_PADDING * 2),
      maxBoxWidth
    );
    const boxHeight = (fullLines.length * LINE_HEIGHT) + PANEL_PADDING * 2;

    if (!tipRevealStarts.has(tipLevel)) {
      tipRevealStarts.set(tipLevel, now);
    }

    const revealStart = tipRevealStarts.get(tipLevel) ?? now;
    const elapsedSeconds = (now - revealStart) / 1000;
    const lettersToShow = Math.floor(elapsedSeconds * LETTERS_PER_SECOND);
    const visibleText = fullLines.join('\n').substring(0, lettersToShow);
    const visibleLines = visibleText.length > 0 ? visibleText.split('\n') : [];

    return {
      leafId,
      buttonLabel,
      boxX: DISPLAY_AREA_X,
      boxY: DISPLAY_AREA_Y,
      boxWidth,
      boxHeight,
      visibleLines,
      buttonRect: { x: 0, y: 0, width: buttonWidth, height: BUTTON_HEIGHT }
    } satisfies SageTipRender;
  });

  const totalHeight = tipsToRender.reduce((sum, tip, index) => {
    return sum + tip.boxHeight + (index > 0 ? PANEL_GAP : 0);
  }, 0);

  const topBoundary = DISPLAY_AREA_Y + 10;
  const bottomAnchor = bottomHudY - 30;
  let currentY = Math.max(topBoundary, bottomAnchor - totalHeight);

  for (const tip of tipsToRender) {
    tip.boxX = DISPLAY_AREA_X + (DISPLAY_AREA_WIDTH - tip.boxWidth) / 2;
    tip.boxY = currentY;
    tip.buttonRect = {
      x: tip.boxX + tip.boxWidth - tip.buttonRect.width + 8,
      y: tip.boxY - 8,
      width: tip.buttonRect.width,
      height: tip.buttonRect.height
    };

    renderTipPanel(ctx, input, tip, channel, runCommand);
    currentY += tip.boxHeight + PANEL_GAP;
  }

  ctx.restore();
}

function renderTipPanel(
  ctx: CanvasRenderingContext2D,
  input: InteractionState,
  tip: SageTipRender,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const { boxX, boxY, boxWidth, boxHeight, visibleLines, buttonLabel, buttonRect, leafId } = tip;

  ctx.fillStyle = COLORS.panel.bg;
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = COLORS.panel.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);

  ctx.fillStyle = COLORS.panel.textPrimary;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = SMALL_TEXT_FONT;

  for (let i = 0; i < visibleLines.length; i += 1) {
    ctx.fillText(visibleLines[i], boxX + PANEL_PADDING, boxY + PANEL_PADDING + (i * LINE_HEIGHT));
  }

  const buttonClicked = doButton(ctx, input, buttonRect, buttonLabel, {
    font: BOTTOM_HUD_BUTTON_FONT,
    showNotice: notices.hasLeafNotice(leafId),
    showNoticePing: true
  });

  notices.reportLeafVisible(leafId, notices.hasLeafNotice(leafId), channel, runCommand);

  if (buttonClicked) {
    notices.reportLeafClicked(leafId, channel, runCommand);
    input.consumed = true;
  }
}

function getVisibleTipLevels(level: number): number[] {
  return Object.keys(SAGE_TIPS)
    .map(Number)
    .filter((tipLevel) => tipLevel <= level && notices.hasLeafNotice(tipLeafId(tipLevel)))
    .sort((a, b) => a - b);
}

function tipLeafId(level: number): string {
  return `leaf.sage_tip.${level}.confirm_button`;
}
