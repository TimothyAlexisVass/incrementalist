import { COLORS } from '../../../../../colors';
import { ServerState } from '../../../../../net/snapshots';
import { getActiveWebGLRenderer } from '../../../../../renderer/webgl';
import { drawAchievementCardPlaceholder } from '../../../../components/cards/achievement';
import { ScrollingPanel } from '../../../../components/scrolling-panel';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { InteractionState } from '../../../../managers/interactions';

const CARD_HEIGHT_PX = 92;
const CARD_GAP_PX = 12;
const CARD_SCROLLBAR_GUTTER_PX = 10;
const ACHIEVEMENT_CARD_COUNT = 30;

let achievementsScrollingPanel: ScrollingPanel | null = null;

export function renderAchievementsTab(
  _canvas: HTMLCanvasElement,
  input: InteractionState,
  _state: ServerState,
  rect: Rect
) {
  const renderer = getActiveWebGLRenderer();
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: cssToRgba(COLORS.panel.bg)
  });

  const listRect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  };

  const cardWidth = Math.max(1, listRect.width - CARD_SCROLLBAR_GUTTER_PX);
  const contentHeight = (ACHIEVEMENT_CARD_COUNT * CARD_HEIGHT_PX) + ((ACHIEVEMENT_CARD_COUNT - 1) * CARD_GAP_PX);
  const scrollingPanel = getScrollingPanel(listRect, contentHeight);

  scrollingPanel.update(input);
  scrollingPanel.drawClippedContent(renderer, (scrollOffsetY) => {
    const startY = listRect.y - scrollOffsetY;
    for (let i = 0; i < ACHIEVEMENT_CARD_COUNT; i++) {
      const cardY = startY + (i * (CARD_HEIGHT_PX + CARD_GAP_PX));

      if (cardY >= listRect.y + listRect.height) break;
      if (cardY + CARD_HEIGHT_PX <= listRect.y) continue;

      drawAchievementCardPlaceholder({
        x: listRect.x,
        y: cardY,
        width: cardWidth,
        height: CARD_HEIGHT_PX
      }, i + 1);
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

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || "").trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}
