import { COLORS } from '../colors.js';
import {
  formatCountRatio,
  formatFileLabel,
  formatInteger,
  formatLevel,
  formatMultiplier,
  formatNumber,
  formatNumberRatio,
  formatSignedPercent,
  formatTimestamp,
  toFiniteNumber
} from '../format.js';
import {
  STATS_SECTION_FONT,
  STATS_LABEL_FONT,
  STATS_VALUE_FONT,
} from '../config.js';

export function renderStatsPanel(ctx, overlayRect, state) {
  const statsLeft = [
    ['Level', formatLevel(state.level)],
    ['EXP', formatNumberRatio(toFiniteNumber(state.exp, 0), toFiniteNumber(state.requiredExp, 1))],
    ['Coins', formatNumber(toFiniteNumber(state.coins, 0))],
    ['Shards', formatNumber(toFiniteNumber(state.shards, 0))],
    ['Cores', formatNumber(toFiniteNumber(state.cores, 0))],
    ['Rewards Claimed', formatNumber(toFiniteNumber(state.progressBar?.rewardsClaimed, 0))],
    ['Current Save File', formatFileLabel(state.fileIndex)]
  ];

  const statsRight = [
    ['Reward Multiplier', formatMultiplier(state.progressBar?.rewardMultiplier, 2, 1)],
    ['Achievement Stars', formatSignedPercent(state.achievements?.totalStars, 2, 0)],
    ['Achievements', formatCountRatio(state.achievements?.unlockedCount, 15)],
    ['Quest Tokens', formatNumber(toFiniteNumber(state.quests?.questTokens, 0))],
    ['Event Tokens', formatNumber(toFiniteNumber(state.quests?.eventTokens, 0))],
    ['Quest Bonus', formatSignedPercent(state.quests?.questMultiplier, 2, 0)],
    ['Consecutive Days', formatInteger(Math.max(0, toFiniteNumber(state.quests?.consecutiveDays, 0)))],
    ['Attendance (Days)', formatInteger(Math.max(0, toFiniteNumber(state.dailyBonus?.streak, 0)))]
  ];

  const leftX = overlayRect.x + 24;
  const rightX = overlayRect.x + Math.floor(overlayRect.width / 2) + 8;
  const startY = overlayRect.y + 122;
  const rowHeight = 34;

  ctx.fillStyle = COLORS.overlay.bodyText;
  ctx.font = STATS_SECTION_FONT;
  ctx.textAlign = 'left';
  ctx.fillText('Core Progress', leftX, overlayRect.y + 104);
  ctx.fillText('Bonuses And Meta', rightX, overlayRect.y + 104);

  for (let i = 0; i < statsLeft.length; i += 1) {
    const y = startY + (i * rowHeight);
    const [label, value] = statsLeft[i];
    ctx.fillStyle = COLORS.overlay.unlockedStateText;
    ctx.font = STATS_LABEL_FONT;
    ctx.fillText(label, leftX, y);
    ctx.fillStyle = COLORS.overlay.bodyText;
    ctx.font = STATS_VALUE_FONT;
    ctx.fillText(String(value), leftX, y + 16);
  }

  for (let i = 0; i < statsRight.length; i += 1) {
    const y = startY + (i * rowHeight);
    const [label, value] = statsRight[i];
    ctx.fillStyle = COLORS.overlay.unlockedStateText;
    ctx.font = STATS_LABEL_FONT;
    ctx.fillText(label, rightX, y);
    ctx.fillStyle = COLORS.overlay.bodyText;
    ctx.font = STATS_VALUE_FONT;
    ctx.fillText(String(value), rightX, y + 16);
  }

  ctx.fillStyle = COLORS.overlay.unlockedStateText;
  ctx.font = STATS_VALUE_FONT;
  ctx.fillText(`First Played: ${formatTimestamp(state.firstPlayedAt)}`, leftX, overlayRect.y + overlayRect.height - 24);
}
