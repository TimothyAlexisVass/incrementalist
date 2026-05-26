import { AchievementState } from '../../../net/protocol';
import { GameChannel } from '../../../net/game-channel';
import { COLORS } from '../../../colors';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import { hexToRgba } from '../../../utils/color';
import { notices } from '../../managers/notices';
import { drawNoticeDot } from '../button';

interface AchievementCardRenderOptions {
  showNotice?: boolean;
}

export function drawAchievementCard(
  achievement: AchievementState,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void,
  renderOptions: AchievementCardRenderOptions = {}
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;
  const { showNotice = true } = renderOptions;

  const isUnlocked = achievement.unlocked_at !== null;
  const bgColor = hexToRgba(isUnlocked ? COLORS.panel.bg : '#0a0a0a');
  const borderColor = hexToRgba(isUnlocked ? COLORS.panel.border : '#2a2a2a');
  const textColor = '#ffffff';

  // Background
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: bgColor
  });

  // Border
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: 1, color: borderColor });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - 1, width: rect.width, height: 1, color: borderColor });
  renderer.drawRect({ x: rect.x, y: rect.y, width: 1, height: rect.height, color: borderColor });
  renderer.drawRect({ x: rect.x + rect.width - 1, y: rect.y, width: 1, height: rect.height, color: borderColor });

  // Name
  renderer.drawText({
    text: achievement.name,
    x: rect.x + 15,
    y: rect.y + 15,
    font: '600 16px "Outfit"',
    color: textColor,
    align: 'left',
    baseline: 'top'
  });

  // Condition
  renderer.drawText({
    text: achievement.condition_text || achievement.condition,
    x: rect.x + 15,
    y: rect.y + 40,
    font: '400 13px "Inter"',
    color: '#ffffff',
    align: 'left',
    baseline: 'top'
  });

  // Multiplier reward
  const multiplierText = `+${(achievement.multiplier * 100).toFixed(2)}% Multiplier`;
  renderer.drawText({
    text: multiplierText,
    x: rect.x + rect.width - 15,
    y: rect.y + rect.height / 2,
    font: '500 14px "Inter"',
    color: '#ffffff',
    align: 'right',
    baseline: 'middle'
  });

  // Notification Dot
  const leafId = `leaf.achievement.${(achievement as any).id}.unlocked`;
  const hasNotice = notices.hasLeafNotice(leafId);
  if (showNotice && hasNotice) {
    const anchor = getAchievementNoticeAnchor(rect);
    drawNoticeDot(anchor.x, anchor.y, anchor.radius);
  }
}

export function getAchievementNoticeAnchor(rect: { x: number; y: number; width: number; height: number }) {
  return {
    x: rect.x + rect.width - 8,
    y: rect.y + 8,
    radius: 5
  };
}
