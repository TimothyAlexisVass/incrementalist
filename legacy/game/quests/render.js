import { COLORS } from '../colors.js';
import { MAIN_QUESTS, DAILY_QUESTS, QUEST_RANK_LABELS } from './defs.js';
import { getMainQuestProgress, getDailyQuestProgress } from './state.js';
import { drawButton, drawHorizontalBar } from '../ui/components.js';
import { formatNumber, formatNumberRatio, formatSignedNumberWithUnit, formatSignedPercent, toFiniteNumber } from '../format.js';
import {
  QUEST_PANEL_TOKENS_FONT,
  QUEST_NAME_FONT,
  QUEST_RANK_FONT,
} from '../config.js';

const MAX_QUEST_RANK = 4;

export function renderQuestsPanel(ctx, overlayRect, state, questTab) {
  const questTokens = Math.floor(toFiniteNumber(state.quests.questTokens, 0));
  const eventTokens = Math.floor(toFiniteNumber(state.quests.eventTokens, 0));
  const questBonus = toFiniteNumber(state.quests.questMultiplier, 0);

  ctx.fillStyle = COLORS.overlay.questTokenText;
  ctx.font = QUEST_PANEL_TOKENS_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`Quest Tokens: ${formatNumber(questTokens)}`, overlayRect.x + 24, overlayRect.y + 104);
  ctx.fillText(`Event Tokens: ${formatNumber(eventTokens)}`, overlayRect.x + 234, overlayRect.y + 104);

  ctx.fillStyle = COLORS.overlay.questBonusText;
  ctx.textAlign = 'right';
  ctx.fillText(`Progress Bonus: ${formatSignedPercent(questBonus)}`, overlayRect.x + overlayRect.width - 24, overlayRect.y + 104);

  const listY = overlayRect.y + 164;
  const rowHeight = 47;
  const barWidth = 230;

  const quests = questTab === 'daily' ? DAILY_QUESTS : MAIN_QUESTS;
  const questIds = Object.keys(quests);
  const questClickZones = [];

  for (let index = 0; index < questIds.length; index += 1) {
    const questId = questIds[index];
    const quest = quests[questId];
    const rowY = listY + (index * rowHeight);
    const rowX = overlayRect.x + 24;
    const rowWidth = overlayRect.width - 48;
    if (rowY + rowHeight > overlayRect.y + overlayRect.height - 60) {
      break;
    }

    const currentRank = questTab === 'daily'
      ? clampRank(state.quests.dailyQuests[questId]?.claimedRank)
      : clampRank(state.quests.mainQuests[questId]);
    const progress = questTab === 'daily'
      ? getDailyQuestProgress(state, questId)
      : getMainQuestProgress(state, questId);

    const nextRank = currentRank >= MAX_QUEST_RANK ? MAX_QUEST_RANK : currentRank + 1;
    const nextRankDef = quest.ranks[nextRank];
    const nextRequirement = nextRankDef ? nextRankDef.requirement : 0;
    const nextReward = nextRankDef ? nextRankDef.reward : 0;
    const ratio = nextRequirement > 0 ? clamp(progress / nextRequirement, 0, 1) : 1;
    const isReady = currentRank < MAX_QUEST_RANK && progress >= nextRequirement;

    questClickZones.push({
      rect: {
        x: rowX,
        y: rowY,
        width: rowWidth,
        height: rowHeight - 4
      },
      questId,
      questTab,
      isReady
    });

    ctx.fillStyle = COLORS.overlay.questRowBackground;
    ctx.fillRect(rowX, rowY, rowWidth, rowHeight - 4);
    ctx.strokeStyle = COLORS.overlay.questRowBorder;
    ctx.strokeRect(rowX, rowY, rowWidth, rowHeight - 4);

    ctx.fillStyle = COLORS.overlay.bodyText;
    ctx.font = QUEST_NAME_FONT;
    ctx.textAlign = 'left';
    ctx.fillText(quest.name, rowX + 10, rowY + 16);

    ctx.fillStyle = COLORS.overlay.questRankText;
    ctx.textAlign = 'right';
    ctx.fillText(`Rank ${QUEST_RANK_LABELS[currentRank]}`, rowX + rowWidth - 10, rowY + 16);

    const barX = rowX + 10;
    const barY = rowY + 24;
    drawHorizontalBar(ctx, {
      x: barX,
      y: barY,
      width: barWidth,
      height: 13,
      ratio,
      gradientStops: isReady
        ? [
          { offset: 0, color: COLORS.bar.quest.readyStart },
          { offset: 1, color: COLORS.bar.quest.readyEnd }
        ]
        : [
          { offset: 0, color: COLORS.bar.quest.pendingStart },
          { offset: 1, color: COLORS.bar.quest.pendingEnd }
        ],
      trackColor: COLORS.bar.track,
      borderColor: COLORS.bar.border,
      lineWidth: 2
    });

    ctx.font = QUEST_RANK_FONT;
    ctx.textAlign = 'left';
    if (currentRank >= MAX_QUEST_RANK) {
      ctx.fillStyle = COLORS.overlay.questProgressReadyText;
      ctx.fillText('Complete', barX + barWidth + 12, rowY + 35);
    } else {
      ctx.fillStyle = isReady ? COLORS.overlay.questProgressReadyText : COLORS.overlay.questProgressPendingText;
      ctx.fillText(
        `Next ${QUEST_RANK_LABELS[nextRank]}: ${formatNumberRatio(progress, nextRequirement)} (${formatSignedNumberWithUnit(nextReward, 'QT')})`,
        barX + barWidth + 12,
        rowY + 35
      );
    }
  }

  return {
    questClickZones
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampRank(value) {
  return clamp(Math.floor(toFiniteNumber(value, 0)), 0, MAX_QUEST_RANK);
}
