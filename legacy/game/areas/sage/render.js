import { SAGE_TIPS } from './tips.js';
import { BOTTOM_HUD_HEIGHT, SMALL_TEXT_FONT } from '../../config.js';
import { COLORS } from '../../colors.js';

let lastLevelForTip = -1;
let tipStartTime = 0;
const LETTERS_PER_SECOND = 40;

export function renderSageArea(ctx, canvas, state) {
  const tips = SAGE_TIPS[state.level];
  if (!tips) {
    lastLevelForTip = state.level;
    return;
  }

  const now = performance.now();
  if (lastLevelForTip !== state.level) {
    lastLevelForTip = state.level;
    tipStartTime = now;
  }

  const textToReveal = tips.join('\n');
  const elapsedSeconds = (now - tipStartTime) / 1000;
  const lettersToShow = Math.floor(elapsedSeconds * LETTERS_PER_SECOND);

  const fullText = `The Sage: ${textToReveal}`;
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

  ctx.fillStyle = COLORS.overlay.panel;
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = COLORS.overlay.panelBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxWidth - 1, boxHeight - 1);

  ctx.fillStyle = COLORS.button.secondary.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], boxX + padding, boxY + padding + i * lineHeight);
  }

  ctx.restore();
}
