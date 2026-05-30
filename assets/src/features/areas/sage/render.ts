import { SAGE_TIP_ORDER, SAGE_TIPS } from './tips';
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
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import { hexToRgba } from '../../../utils/color';
import { clearUpdatingTextKeysByPrefix } from '../../../utils/text';
import { resolveStableText } from '../../../renderer/stable-text';

const LETTERS_PER_SECOND = 40;
const PANEL_PADDING = 16;
const PANEL_TOP_PADDING = 11;
const PANEL_GAP = 12;
const LINE_HEIGHT = 20;
const BUTTON_HEIGHT = 30;
const BUTTON_MIN_WIDTH = 88;
const BUTTON_INNER_PADDING = 14;
const SAGE_HEADER_TEXT = 'The Sage:';
const SAGE_HEADER_FONT = 'bold 14px Arial';
const SAGE_HEADER_MARGIN_BOTTOM = 5;

const tipRevealStarts = new Map<string, number>();

type SageTipRender = {
  tipId: string;
  leafId: string;
  buttonLabel: string;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  fullLines: string[];
  lineWidths: number[];
  visibleCharCounts: number[];
  buttonRect: { x: number; y: number; width: number; height: number };
};

export function renderSageArea(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  _level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void,
  blocked: boolean = false
) {
  const renderer = getActiveWebGLRenderer();
  const visibleTipIds = getVisibleTipIds();
  const visibleIdSet = new Set(visibleTipIds);

  for (const tipId of Array.from(tipRevealStarts.keys())) {
    if (!visibleIdSet.has(tipId)) {
      tipRevealStarts.delete(tipId);
      clearUpdatingTextKeysByPrefix(getSageTipTextKeyPrefix(tipId));
    }
  }

  if (visibleTipIds.length === 0) {
    return;
  }

  const now = performance.now();
  const bottomHudY = canvas.height - BOTTOM_HUD_HEIGHT;
  const maxBoxWidth = DISPLAY_AREA_WIDTH - 40;

  const tipsToRender = visibleTipIds.map((tipId) => {
    const tip = SAGE_TIPS[tipId];
    const leafId = tipLeafId(tipId);
    const buttonLabel = tip.confirmation || 'Alright';
    const fullLines = tip.text;
    const lineWidths = fullLines.map((line) => (renderer ? renderer.measureTextWidth({ text: line, font: SMALL_TEXT_FONT }) : 0));
    const maxLineWidth = lineWidths.reduce((maxWidth, lineWidth) => Math.max(maxWidth, lineWidth), 0);
    const headerWidth = renderer ? renderer.measureTextWidth({ text: SAGE_HEADER_TEXT, font: SAGE_HEADER_FONT }) : 0;

    const buttonWidth = Math.max(
      BUTTON_MIN_WIDTH,
      Math.ceil((renderer ? renderer.measureTextWidth({ text: buttonLabel, font: BOTTOM_HUD_BUTTON_FONT }) : 0) + BUTTON_INNER_PADDING * 2)
    );

    const boxWidth = Math.min(
      Math.max(Math.max(maxLineWidth, headerWidth) + PANEL_PADDING * 2, buttonWidth + PANEL_PADDING * 2),
      maxBoxWidth
    );
    const boxHeight =
      PANEL_TOP_PADDING +
      LINE_HEIGHT +
      SAGE_HEADER_MARGIN_BOTTOM +
      (fullLines.length * LINE_HEIGHT) +
      PANEL_PADDING;

    if (!tipRevealStarts.has(tipId)) {
      tipRevealStarts.set(tipId, now);
    }

    const revealStart = tipRevealStarts.get(tipId) ?? now;
    const elapsedSeconds = (now - revealStart) / 1000;
    const lettersToShow = Math.floor(elapsedSeconds * LETTERS_PER_SECOND);
    const visibleCharCounts = getVisibleCharCounts(fullLines, lettersToShow);

    return {
      leafId,
      tipId,
      buttonLabel,
      boxX: DISPLAY_AREA_X,
      boxY: DISPLAY_AREA_Y,
      boxWidth,
      boxHeight,
      fullLines,
      lineWidths,
      visibleCharCounts,
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

    renderTipPanel(input, tip, channel, runCommand, renderer, blocked);
    currentY += tip.boxHeight + PANEL_GAP;
  }

  // No longer using ctx.restore() since we removed ctx.save()
}

function renderTipPanel(
  input: InteractionState,
  tip: SageTipRender,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void,
  renderer = getActiveWebGLRenderer(),
  blocked: boolean = false
) {
  if (!renderer) return;
  const { boxX, boxY, boxWidth, boxHeight, fullLines, visibleCharCounts, buttonLabel, buttonRect, leafId } = tip;

  renderer.drawRect({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: hexToRgba(COLORS.panel.bg)
  });
  renderer.drawRect({
    x: boxX + 0.5,
    y: boxY + 0.5,
    width: boxWidth - 1,
    height: 1,
    color: hexToRgba(COLORS.panel.border)
  });
  renderer.drawRect({
    x: boxX + 0.5,
    y: boxY + boxHeight - 1.5,
    width: boxWidth - 1,
    height: 1,
    color: hexToRgba(COLORS.panel.border)
  });
  renderer.drawRect({
    x: boxX + 0.5,
    y: boxY + 0.5,
    width: 1,
    height: boxHeight - 1,
    color: hexToRgba(COLORS.panel.border)
  });
  renderer.drawRect({
    x: boxX + boxWidth - 1.5,
    y: boxY + 0.5,
    width: 1,
    height: boxHeight - 1,
    color: hexToRgba(COLORS.panel.border)
  });
  renderer.drawText({
    text: SAGE_HEADER_TEXT,
    x: boxX + PANEL_PADDING,
    y: boxY + PANEL_TOP_PADDING,
    font: SAGE_HEADER_FONT,
    color: COLORS.panel.textPrimary,
    align: 'left',
    baseline: 'top'
  });

  const bodyStartY = boxY + PANEL_TOP_PADDING + LINE_HEIGHT + SAGE_HEADER_MARGIN_BOTTOM;

  for (let i = 0; i < fullLines.length; i += 1) {
    const fullLine = fullLines[i];
    const visibleChars = visibleCharCounts[i] ?? 0;
    const x = boxX + PANEL_PADDING;
    const y = bodyStartY + (i * LINE_HEIGHT);
    const nextVisibleLine = fullLine.slice(0, visibleChars);
    const renderedLine = resolveStableText(
      getSageTipLineTextKey(leafId, i),
      nextVisibleLine,
      {
        font: SMALL_TEXT_FONT,
        color: COLORS.panel.textPrimary,
        align: 'left',
        baseline: 'top'
      }
    );

    renderer.drawText({
      text: renderedLine,
      x,
      y,
      font: SMALL_TEXT_FONT,
      color: COLORS.panel.textPrimary,
      align: 'left',
      baseline: 'top'
    });
  }

  const buttonClicked = !blocked && doButton(input, buttonRect, buttonLabel, {
    font: BOTTOM_HUD_BUTTON_FONT,
    showNotice: notices.hasLeafNotice(leafId)
  });

  notices.reportLeafVisible(leafId, notices.hasLeafNotice(leafId), channel, runCommand);

  if (buttonClicked) {
    notices.reportLeafClicked(leafId, channel, runCommand);
    input.consumed = true;
  }
}


function getVisibleTipIds(): string[] {
  return SAGE_TIP_ORDER.filter((tipId) => notices.hasLeafNotice(tipLeafId(tipId)));
}

function tipLeafId(tipId: string): string {
  return `leaf.sage_tip.${tipId}.confirm_button`;
}

function getSageTipTextKeyPrefix(tipId: string): string {
  return `sage.tip.${tipLeafId(tipId)}.`;
}

function getSageTipLineTextKey(leafId: string, lineIndex: number): string {
  return `sage.tip.${leafId}.line.${lineIndex}`;
}

function getVisibleCharCounts(fullLines: string[], lettersToShow: number): number[] {
  let remaining = Math.max(0, lettersToShow);

  return fullLines.map((line, index) => {
    const visibleChars = Math.min(line.length, remaining);
    const hasTrailingNewline = index < fullLines.length - 1;
    remaining = Math.max(0, remaining - line.length - (hasTrailingNewline ? 1 : 0));
    return visibleChars;
  });
}
