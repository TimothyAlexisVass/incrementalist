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
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

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
  canvas: HTMLCanvasElement,
  input: InteractionState,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const renderer = getActiveWebGLRenderer();
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

  const tipsToRender = visibleTipLevels.map((tipLevel) => {
    const tip = SAGE_TIPS[tipLevel];
    const leafId = tipLeafId(tipLevel);
    const buttonLabel = tip.confirmation || 'Alright';
    const fullLines = tip.text;
    const maxLineWidth = fullLines.reduce((maxWidth, line) => {
      const lineWidth = renderer ? renderer.measureTextWidth({ text: line, font: SMALL_TEXT_FONT }) : 0;
      return Math.max(maxWidth, lineWidth);
    }, 0);
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

    renderTipPanel(input, tip, channel, runCommand, renderer);
    currentY += tip.boxHeight + PANEL_GAP;
  }

  // No longer using ctx.restore() since we removed ctx.save()
}

function renderTipPanel(
  input: InteractionState,
  tip: SageTipRender,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void,
  renderer = getActiveWebGLRenderer()
) {
  if (!renderer) return;
  const { boxX, boxY, boxWidth, boxHeight, visibleLines, buttonLabel, buttonRect, leafId } = tip;

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

  for (let i = 0; i < visibleLines.length; i += 1) {
    const x = boxX + PANEL_PADDING;
    const y = bodyStartY + (i * LINE_HEIGHT);
    renderer.drawText({
      text: visibleLines[i],
      x,
      y,
      font: SMALL_TEXT_FONT,
      color: COLORS.panel.textPrimary,
      align: 'left',
      baseline: 'top'
    });
  }

  const buttonClicked = doButton(input, buttonRect, buttonLabel, {
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

function hexToRgba(hex: string): [number, number, number, number] {
  const normalized = String(hex || "").trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) return [0, 0, 0, 1];
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
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
