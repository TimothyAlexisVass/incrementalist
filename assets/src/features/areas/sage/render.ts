import { SAGE_TIPS } from './tips';
import { BOTTOM_HUD_HEIGHT, DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT, SMALL_TEXT_FONT } from '../../../config';
import { InteractionState, pointInRect } from '../../../ui/interaction-manager';
import { noticeAck } from '../../../net/commands';
import { GameChannel } from '../../../net/game-channel';
import { noticeSystem } from '../../../ui/notice-system';
import { COLORS } from '../../../colors';
import { getAreaViewModel } from '../view-model';

const LETTERS_PER_SECOND = 40;

export function renderSageArea(
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement, 
  input: InteractionState, 
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const model = getAreaViewModel().sage;
  const tips = SAGE_TIPS[level];
  
  if (!tips) {
    model.lastLevelForTip = level;
    return;
  }

  const now = performance.now();
  if (model.lastLevelForTip !== level) {
    model.lastLevelForTip = level;
    model.tipStartTime = now;
    model.tipText = tips.join('\n');
  }

  const elapsedSeconds = (now - model.tipStartTime) / 1000;
  const lettersToShow = Math.floor(elapsedSeconds * LETTERS_PER_SECOND);

  const fullText = `The Sage: ${model.tipText}`;
  const visibleText = fullText.substring(0, lettersToShow + 10); // +10 for "The Sage: "

  ctx.save();
  ctx.font = SMALL_TEXT_FONT;

  const lines = visibleText.split('\n');
  const fullLines = fullText.split('\n');

  let maxLineWidth = 0;
  for (const line of fullLines) {
    const width = ctx.measureText(line).width;
    if (width > maxLineWidth) {
      maxLineWidth = width;
    }
  }

  const lineHeight = 20;
  const padding = 16;
  
  // Constrain width to display area
  const boxWidth = Math.min(maxLineWidth + padding * 2, DISPLAY_AREA_WIDTH - 40);
  const boxHeight = (fullLines.length * lineHeight) + padding * 2;

  const bottomHudY = canvas.height - BOTTOM_HUD_HEIGHT;
  
  // Center horizontally within DISPLAY_AREA
  const boxX = DISPLAY_AREA_X + (DISPLAY_AREA_WIDTH - boxWidth) / 2;
  
  // Position vertically within DISPLAY_AREA, anchored above bottom HUD
  let boxY = bottomHudY - 30 - boxHeight;
  
  // Clamp to display area boundaries
  boxY = Math.max(DISPLAY_AREA_Y + 10, Math.min(boxY, DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT - boxHeight - 10));

  ctx.fillStyle = COLORS.panel.bg; // Reusing panel bg for consistency
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = COLORS.panel.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);

  ctx.fillStyle = COLORS.panel.textPrimary;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], boxX + padding, boxY + padding + i * lineHeight);
  }

  // Handle interaction to clear notice
  if (pointInRect(input.pointer, { x: boxX, y: boxY, width: boxWidth, height: boxHeight }) && input.clicked && !input.consumed) {
    if (channel && runCommand && noticeSystem.hasSageNotice()) {
      runCommand(() => noticeAck(channel, 'area_dropdown'));
      input.consumed = true;
    }
  }

  ctx.restore();
}
