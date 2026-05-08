import { SAGE_TIPS } from './tips';
import { BOTTOM_HUD_HEIGHT, SMALL_TEXT_FONT } from '../../../config';
import { COLORS } from '../../../colors';
import { getAreaViewModel } from '../view-model';

const LETTERS_PER_SECOND = 40;

export function renderSageArea(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, level: number) {
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
  const boxWidth = maxLineWidth + padding * 2;
  const boxHeight = (fullLines.length * lineHeight) + padding * 2;

  const bottomHudY = canvas.height - BOTTOM_HUD_HEIGHT;
  const boxY = bottomHudY - 30 - boxHeight;
  const boxX = (canvas.width - boxWidth) / 2;

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

  ctx.restore();
}
