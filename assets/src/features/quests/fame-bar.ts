import { COLORS } from '../../colors';
import { QUEST_FAME_BAR_WIDTH, QUEST_FAME_BAR_HEIGHT, QUEST_FAME_BAR_ROW_HEIGHT } from '../../config';
import { spawnGpuProgressCompletionBurst } from '../../render/webgl-effects';
import { Rect } from '../../ui/components/tab-menu/tab-menu';

const QUEST_FAME_BAR_LEVEL_UP_COLORS = Object.freeze([
  COLORS.bar.fame.fillStart,
  COLORS.bar.fame.fillEnd,
  '#ffffff',
  '#18d9df'
]);

let lastQuestFameBarContainerRect: Rect | null = null;

export function setQuestFameBarContainerRect(rect: Rect) {
  lastQuestFameBarContainerRect = rect;
}

export function getQuestFameBarRect(rect: Rect) {
  const barWidth = QUEST_FAME_BAR_WIDTH;
  const questCardRightEdgeX = rect.x + rect.width - 12;
  const barX = questCardRightEdgeX - barWidth;
  const barY = rect.y + Math.floor((QUEST_FAME_BAR_ROW_HEIGHT - QUEST_FAME_BAR_HEIGHT) / 2);

  return {
    x: barX,
    y: barY,
    width: barWidth,
    height: QUEST_FAME_BAR_HEIGHT
  };
}

export function spawnQuestFameLevelUpBurst() {
  if (!lastQuestFameBarContainerRect) {
    return false;
  }

  const barRect = getQuestFameBarRect(lastQuestFameBarContainerRect);
  spawnGpuProgressCompletionBurst(
    barRect.x,
    barRect.y,
    barRect.width,
    barRect.height,
    QUEST_FAME_BAR_LEVEL_UP_COLORS as any,
    {
      countMultiplier: 3,
      gravity: 520,
      lifeMultiplier: 2
    }
  );

  return true;
}
