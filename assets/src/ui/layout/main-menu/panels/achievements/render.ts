import { COLORS } from '../../../../../colors';
import { ServerState } from '../../../../../net/snapshots';
import { getActiveWebGLRenderer } from '../../../../../renderer/webgl';
import { drawNoticeDot } from '../../../../components/button';
import { drawAchievementCard, getAchievementNoticeAnchor } from '../../../../components/cards/achievement';
import { ScrollingPanel } from '../../../../components/scrolling-panel';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { InteractionState } from '../../../../managers/interactions';
import { GameSnapshot } from '../../../../../net/protocol';
import { getAchievementViewModel } from './view-model';
import { getNetwork } from '../../view-model';
import { markViewed } from '../../../../../net/commands';
import { hexToRgba } from '../../../../../utils/color';
import { doCheckbox } from '../../../../components/checkbox';
import { notices } from '../../../../managers/notices';

const CARD_HEIGHT_PX = 80;
const CARD_GAP_PX = 8;
const CARD_SCROLLBAR_GUTTER_PX = 12;

let achievementsScrollingPanel: ScrollingPanel | null = null;
let lastViewedSnapshot: GameSnapshot | null = null;
let hideCompleted = false;

export function renderAchievementsTab(
  _canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState,
  rect: Rect
) {
  const snapshot = state.snapshot;
  if (!snapshot) return;

  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  if (snapshot !== lastViewedSnapshot) {
    lastViewedSnapshot = snapshot;
  }

  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: hexToRgba(COLORS.panel.bg)
  });

  const allAchievements = getAchievementViewModel(snapshot);
  const totalMultiplier = allAchievements
    .filter(a => a.unlocked_at)
    .reduce((sum, a) => sum + a.multiplier, 0);

  // Header area
  const headerHeight = 32;
  const headerY = rect.y;
  
  // Draw Checkbox
  const checkboxSize = 20;
  const checkboxLabel = "Hide completed";
  const checkboxX = rect.x + rect.width - 150; 
  
  if (doCheckbox(input, checkboxX, headerY + (headerHeight - checkboxSize) / 2, checkboxSize, hideCompleted)) {
    hideCompleted = !hideCompleted;
  }

  renderer.drawText({
    text: checkboxLabel,
    x: checkboxX + checkboxSize + 8,
    y: headerY + headerHeight / 2,
    font: '400 14px "Inter"',
    color: COLORS.panel.textPrimary,
    align: 'left',
    baseline: 'middle'
  });

  // Draw Multiplier to the left of the checkbox
  renderer.drawText({
    text: `Multiplier: ${(totalMultiplier * 100).toFixed(2)}%`,
    x: checkboxX - 20,
    y: headerY + headerHeight / 2,
    font: '600 16px "Outfit"',
    color: COLORS.panel.textPrimary,
    align: 'right',
    baseline: 'middle'
  });

  const achievements = hideCompleted 
    ? allAchievements.filter(a => !a.unlocked_at)
    : allAchievements;

  const listRect = {
    x: rect.x,
    y: rect.y + headerHeight + 5,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height - headerHeight - 5)
  };

  const cardWidth = Math.max(1, listRect.width - CARD_SCROLLBAR_GUTTER_PX);
  const contentHeight = (achievements.length * CARD_HEIGHT_PX) + (Math.max(0, achievements.length - 1) * CARD_GAP_PX);
  const scrollingPanel = getScrollingPanel(listRect, contentHeight);
  const noticeAnchors: Array<{ x: number; y: number; radius: number }> = [];

  scrollingPanel.update(input);
  scrollingPanel.drawClippedContent(renderer, (scrollOffsetY) => {
    const startY = listRect.y - scrollOffsetY;
    for (let i = 0; i < achievements.length; i++) {
      const achievement = achievements[i];
      const cardY = startY + (i * (CARD_HEIGHT_PX + CARD_GAP_PX));

      if (cardY >= listRect.y + listRect.height) break;
      if (cardY + CARD_HEIGHT_PX <= listRect.y) continue;

      const { channel, runCommand } = getNetwork();
      const cardRect = {
        x: listRect.x,
        y: cardY,
        width: cardWidth,
        height: CARD_HEIGHT_PX
      };
      drawAchievementCard(achievement, cardRect, channel || undefined, runCommand || undefined, { showNotice: false });

      const leafId = `leaf.achievement.${(achievement as any).id}.unlocked`;
      if (notices.hasLeafNotice(leafId)) {
        noticeAnchors.push(getAchievementNoticeAnchor(cardRect));
      }
    }
  });
  scrollingPanel.drawScrollBar(renderer);

  for (const anchor of noticeAnchors) {
    drawNoticeDot(anchor.x, anchor.y, anchor.radius);
  }
}

function getScrollingPanel(rect: Rect, contentHeight: number): ScrollingPanel {
  if (!achievementsScrollingPanel) {
    achievementsScrollingPanel = new ScrollingPanel({ rect, contentHeight });
  }

  achievementsScrollingPanel.setRect(rect);
  achievementsScrollingPanel.setContentHeight(contentHeight);
  return achievementsScrollingPanel;
}
