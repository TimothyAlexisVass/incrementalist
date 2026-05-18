import { COLORS } from '../../../colors';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import { QuestState } from '../../../net/protocol';
import { GameChannel } from '../../../net/game-channel';
import { notices } from '../../managers/notices';
import { drawNoticeDot } from '../button';

export interface QuestCardOptions {
  quest: QuestState;
  rect: { x: number; y: number; width: number; height: number };
  onClaim?: () => void;
  channel?: GameChannel;
  runCommand?: (cmd: () => Promise<any>) => void;
  showNotice?: boolean;
}

export function drawQuestCard(options: QuestCardOptions) {
  const { quest, rect, onClaim, channel, runCommand, showNotice = true } = options;
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const isCompleted = quest.rank > quest.claimed_rank;
  const canClaim = isCompleted;

  // Background
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: [0.15, 0.15, 0.2, 1.0] as const
  });

  // Border
  const borderColor = isCompleted ? ([0.2, 0.8, 0.4, 1.0] as const) : ([0.3, 0.3, 0.4, 1.0] as const);
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: 1, color: borderColor });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - 1, width: rect.width, height: 1, color: borderColor });
  renderer.drawRect({ x: rect.x, y: rect.y, width: 1, height: rect.height, color: borderColor });
  renderer.drawRect({ x: rect.x + rect.width - 1, y: rect.y, width: 1, height: rect.height, color: borderColor });

  // Name
  renderer.drawText({
    text: quest.name,
    x: rect.x + 12,
    y: rect.y + 12,
    font: 'bold 16px Arial',
    color: COLORS.panel.textPrimary,
    align: 'left',
    baseline: 'top'
  });

  // Rank Info
  renderer.drawText({
    text: `Rank ${quest.claimed_rank + 1}/${quest.max_rank}`,
    x: rect.x + rect.width - 12,
    y: rect.y + 12,
    font: '12px Arial',
    color: COLORS.panel.textSecondary,
    align: 'right',
    baseline: 'top'
  });

  // Progress Bar Background
  const barX = rect.x + 12;
  const barY = rect.y + 40;
  const barWidth = rect.width - 24;
  const barHeight = 8;
  renderer.drawRect({
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight,
    color: [0.1, 0.1, 0.15, 1.0] as const
  });

  // Progress Bar Fill
  const fillWidth = barWidth * quest.progress;
  renderer.drawRect({
    x: barX,
    y: barY,
    width: fillWidth,
    height: barHeight,
    color: isCompleted ? ([0.2, 0.8, 0.4, 1.0] as const) : ([0.4, 0.6, 1.0, 1.0] as const)
  });

  // Claim Button or Status
  if (canClaim) {
    const claimRect = getQuestClaimButtonRect(rect);
    const btnX = claimRect.x;
    const btnY = claimRect.y;
    const btnWidth = claimRect.width;
    const btnHeight = claimRect.height;

    renderer.drawRect({
      x: btnX,
      y: btnY,
      width: btnWidth,
      height: btnHeight,
      color: [0.2, 0.6, 0.3, 1.0] as const
    });

    renderer.drawText({
      text: 'CLAIM',
      x: btnX + btnWidth / 2,
      y: btnY + btnHeight / 2,
      font: 'bold 14px Arial',
      color: '#ffffff',
      align: 'center',
      baseline: 'middle'
    });

    // Notification Dot
    const leafId = `leaf.quest.${(quest as any).id}.claim_button`;
    const hasNotice = notices.hasLeafNotice(leafId);
    if (showNotice && hasNotice) {
      const anchor = getQuestNoticeAnchor(rect);
      drawNoticeDot(anchor.x, anchor.y, anchor.radius);

      notices.reportLeafVisible(leafId, true, channel, runCommand);
    }
  } else if (quest.claimed_rank >= quest.max_rank) {
    renderer.drawText({
      text: 'COMPLETED',
      x: rect.x + rect.width - 12,
      y: rect.y + rect.height - 12,
      font: 'italic 12px Arial',
      color: '#999999',
      align: 'right',
      baseline: 'bottom'
    });
  } else {
    const percent = quest.progress * 100;
    const percentText = percent > 0 && percent < 10 ? percent.toFixed(2) : Math.floor(percent).toString();
    renderer.drawText({
      text: `${percentText}%`,
      x: rect.x + rect.width - 12,
      y: rect.y + rect.height - 12,
      font: '12px Arial',
      color: COLORS.panel.textSecondary,
      align: 'right',
      baseline: 'bottom'
    });
  }
}

export function isQuestClaimClicked(
  pointer: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  const claimRect = getQuestClaimButtonRect(rect);

  return (
    pointer.x >= claimRect.x &&
    pointer.x <= claimRect.x + claimRect.width &&
    pointer.y >= claimRect.y &&
    pointer.y <= claimRect.y + claimRect.height
  );
}

export function getQuestClaimButtonRect(rect: { x: number; y: number; width: number; height: number }) {
  const btnWidth = 80;
  const btnHeight = 28;
  return {
    x: rect.x + rect.width - btnWidth - 12,
    y: rect.y + rect.height - btnHeight - 12,
    width: btnWidth,
    height: btnHeight
  };
}

export function getQuestNoticeAnchor(rect: { x: number; y: number; width: number; height: number }) {
  const claimRect = getQuestClaimButtonRect(rect);
  return {
    x: claimRect.x + claimRect.width - 4,
    y: claimRect.y + 4,
    radius: 5
  };
}
