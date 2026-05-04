import { COLORS } from '../colors.js';
import { ACHIEVEMENT_DEFS } from './defs.js';
import { formatCountRatio, formatSignedPercent, toFiniteNumber } from '../format.js';
import {
  ACHIEVEMENT_STARS_FONT,
  ACHIEVEMENT_UNLOCKED_FONT,
  ACHIEVEMENT_NAME_FONT
} from '../config.js';

export function renderAchievementsPanel(ctx, overlayRect, state) {
  const totalStars = toFiniteNumber(state.achievements.totalStars, 0);
  const unlockedCount = Math.floor(toFiniteNumber(state.achievements.unlockedCount, 0));

  ctx.fillStyle = COLORS.overlay.starsText;
  ctx.font = ACHIEVEMENT_STARS_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`Stars: ${formatSignedPercent(totalStars)}`, overlayRect.x + 24, overlayRect.y + 112);

  ctx.fillStyle = COLORS.overlay.unlockedStateText;
  ctx.font = ACHIEVEMENT_UNLOCKED_FONT;
  ctx.fillText(`Unlocked: ${formatCountRatio(unlockedCount, Object.keys(ACHIEVEMENT_DEFS).length)}`, overlayRect.x + 230, overlayRect.y + 112);

  const rowHeight = 20;
  let y = overlayRect.y + 146;
  for (const [achievementId, def] of Object.entries(ACHIEVEMENT_DEFS)) {
    const unlocked = Boolean(state.achievements.unlocked[achievementId]);
    const status = unlocked ? '[x]' : '[ ]';

    ctx.fillStyle = unlocked ? COLORS.overlay.statusUnlocked : COLORS.overlay.statusLocked;
    ctx.font = ACHIEVEMENT_NAME_FONT;
    ctx.textAlign = 'left';
    ctx.fillText(status, overlayRect.x + 24, y);

    ctx.fillStyle = COLORS.overlay.bodyText;
    ctx.fillText(def.name, overlayRect.x + 58, y);

    ctx.fillStyle = COLORS.overlay.starsText;
    ctx.textAlign = 'right';
    ctx.fillText(formatSignedPercent(def.stars), overlayRect.x + overlayRect.width - 26, y);

    y += rowHeight;
    if (y > overlayRect.y + overlayRect.height - 18) {
      break;
    }
  }
}
