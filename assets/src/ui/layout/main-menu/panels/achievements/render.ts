import { COLORS } from '../../../../../colors';
import { ServerState } from '../../../../../net/snapshots';
import { getActiveWebGLRenderer } from '../../../../../renderer/webgl';
import { drawAchievementCard } from '../../../../components/cards/achievement';
import { ScrollingPanel } from '../../../../components/scrolling-panel';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { InteractionState } from '../../../../managers/interactions';
import { GameSnapshot } from '../../../../../net/protocol';
import { getAchievementViewModel } from './view-model';
import { getNetwork } from '../../view-model';
import { markViewed } from '../../../../../net/commands';
import { hexToRgba } from '../../../../../utils/color';

const CARD_HEIGHT_PX = 80;
const CARD_GAP_PX = 8;
const CARD_SCROLLBAR_GUTTER_PX = 12;

let achievementsScrollingPanel: ScrollingPanel | null = null;
let lastViewedSnapshot: GameSnapshot | null = null;

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

  // Track viewing for achievement
  if (snapshot !== lastViewedSnapshot && !snapshot.state.stats.screens_viewed_achievements) {
    lastViewedSnapshot = snapshot;
    const { channel } = getNetwork();
    if (channel) {
      markViewed(channel, 'achievements');
    }
  }

  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: hexToRgba(COLORS.panel.bg)
  });

  const achievements = getAchievementViewModel(snapshot);
  const listRect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  };

  const cardWidth = Math.max(1, listRect.width - CARD_SCROLLBAR_GUTTER_PX);
  const contentHeight = (achievements.length * CARD_HEIGHT_PX) + (Math.max(0, achievements.length - 1) * CARD_GAP_PX);
  const scrollingPanel = getScrollingPanel(listRect, contentHeight);

  scrollingPanel.update(input);
  scrollingPanel.drawClippedContent(renderer, (scrollOffsetY) => {
    const startY = listRect.y - scrollOffsetY;
    for (let i = 0; i < achievements.length; i++) {
      const achievement = achievements[i];
      const cardY = startY + (i * (CARD_HEIGHT_PX + CARD_GAP_PX));

      if (cardY >= listRect.y + listRect.height) break;
      if (cardY + CARD_HEIGHT_PX <= listRect.y) continue;

      const { channel, runCommand } = getNetwork();
      drawAchievementCard(achievement, {
        x: listRect.x,
        y: cardY,
        width: cardWidth,
        height: CARD_HEIGHT_PX
      }, channel || undefined, runCommand || undefined);
    }
  });
  scrollingPanel.drawScrollBar(renderer);
}

function getScrollingPanel(rect: Rect, contentHeight: number): ScrollingPanel {
  if (!achievementsScrollingPanel) {
    achievementsScrollingPanel = new ScrollingPanel({ rect, contentHeight });
  }

  achievementsScrollingPanel.setRect(rect);
  achievementsScrollingPanel.setContentHeight(contentHeight);
  return achievementsScrollingPanel;
}

