import { AchievementState } from '../../../net/protocol';
import { COLORS } from '../../../colors';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import { hexToRgba } from '../../../utils/color';

export function drawAchievementCard(
  achievement: AchievementState,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const isUnlocked = achievement.unlocked_at !== null;
  const bgColor = hexToRgba(isUnlocked ? COLORS.panel.bg : '#0a0a0a');
  const borderColor = hexToRgba(isUnlocked ? COLORS.panel.border : '#2a2a2a');
  const textColor = isUnlocked ? COLORS.panel.textPrimary : COLORS.panel.textDisabled;

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
    text: getConditionText(achievement.condition),
    x: rect.x + 15,
    y: rect.y + 40,
    font: '400 13px "Inter"',
    color: isUnlocked ? COLORS.panel.textSecondary : COLORS.panel.textDisabled,
    align: 'left',
    baseline: 'top'
  });

  // Star reward
  const starText = `+${(achievement.stars * 100).toFixed(2)}% Stars`;
  renderer.drawText({
    text: starText,
    x: rect.x + rect.width - 15,
    y: rect.y + rect.height / 2,
    font: '500 14px "Inter"',
    color: isUnlocked ? '#ffd700' : COLORS.panel.textDisabled,
    align: 'right',
    baseline: 'middle'
  });
}

function getConditionText(condition: string): string {
  switch (condition) {
    case "tutorial_graduated": return "Complete the tutorial.";
    case "level_10": return "Reach Level 10.";
    case "level_20": return "Reach Level 20.";
    case "level_40": return "Reach Level 40.";
    case "rewards_50": return "Claim 50 progress rewards.";
    case "rewards_250": return "Claim 250 progress rewards.";
    case "rewards_500": return "Claim 500 progress rewards.";
    case "rewards_1000": return "Claim 1000 progress rewards.";
    case "coins_50000": return "Earn 50,000 lifetime coins.";
    case "coins_100000": return "Earn 100,000 lifetime coins.";
    case "shards_2500": return "Earn 2,500 lifetime shards.";
    case "cores_100": return "Earn 100 lifetime cores.";
    case "screens_viewed_stats": return "View the stats screen.";
    case "screens_viewed_quests": return "View the quests screen.";
    case "screens_viewed_achievements": return "View the achievements screen.";
    default: return condition;
  }
}
