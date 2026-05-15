import { COLORS } from '../../../../../colors';
import { ServerState } from '../../../../../net/snapshots';
import { getActiveWebGLRenderer } from '../../../../../renderer/webgl';
import { drawQuestCardPlaceholder } from '../../../../components/cards/quest';
import { ScrollingPanel } from '../../../../components/scrolling-panel';
import { Rect, TabDefinition, TabMenu } from '../../../../components/tab-menu/tab-menu';
import { InteractionState } from '../../../../managers/interactions';

const CARD_HEIGHT_PX = 92;
const CARD_GAP_PX = 12;
const CARD_SCROLLBAR_GUTTER_PX = 10;
const DAILY_CARD_COUNT = 24;
const MAIN_CARD_COUNT = 28;

let questSubTabs: TabMenu | null = null;
let dailyScrollingPanel: ScrollingPanel | null = null;
let mainScrollingPanel: ScrollingPanel | null = null;

export function renderQuestsTab(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  _state: ServerState,
  rect: Rect
) {
  drawQuestPanelFrame(rect);
  getQuestSubTabs().render(canvas, input, _state, rect);
}

function getQuestSubTabs(): TabMenu {
  if (!questSubTabs) {
    const tabs: TabDefinition[] = [
      {
        id: 'daily',
        label: 'Daily',
        renderContent: (_canvas, input, _state, rect) => {
          renderQuestPlaceholderList(input, rect, DAILY_CARD_COUNT, 'daily');
        }
      },
      {
        id: 'main',
        label: 'Main',
        renderContent: (_canvas, input, _state, rect) => {
          renderQuestPlaceholderList(input, rect, MAIN_CARD_COUNT, 'main');
        }
      }
    ];

    questSubTabs = new TabMenu(tabs, {
      layout: 'horizontal',
      position: 'top-left',
      tabHeight: 32,
      tabPadding: 18,
      gap: 6,
      contentGap: 4,
      font: 'bold 14px Arial'
    }, 'daily');
  }

  return questSubTabs;
}

function renderQuestPlaceholderList(
  input: InteractionState,
  rect: Rect,
  count: number,
  panelKey: 'daily' | 'main'
) {
  const renderer = getActiveWebGLRenderer();
  const listRect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  };

  const cardWidth = Math.max(1, listRect.width - CARD_SCROLLBAR_GUTTER_PX);
  const contentHeight = (count * CARD_HEIGHT_PX) + (Math.max(0, count - 1) * CARD_GAP_PX);
  const scrollingPanel = getScrollingPanel(panelKey, listRect, contentHeight);

  scrollingPanel.update(input);
  scrollingPanel.drawClippedContent(renderer, (scrollOffsetY) => {
    const startY = listRect.y - scrollOffsetY;
    for (let i = 0; i < count; i++) {
      const cardY = startY + (i * (CARD_HEIGHT_PX + CARD_GAP_PX));

      if (cardY >= listRect.y + listRect.height) break;
      if (cardY + CARD_HEIGHT_PX <= listRect.y) continue;

      drawQuestCardPlaceholder({
        x: listRect.x,
        y: cardY,
        width: cardWidth,
        height: CARD_HEIGHT_PX
      }, i + 1);
    }
  });
  scrollingPanel.drawScrollBar(renderer);
}

function getScrollingPanel(panelKey: 'daily' | 'main', rect: Rect, contentHeight: number): ScrollingPanel {
  if (panelKey === 'daily') {
    if (!dailyScrollingPanel) {
      dailyScrollingPanel = new ScrollingPanel({ rect, contentHeight });
    }
    dailyScrollingPanel.setRect(rect);
    dailyScrollingPanel.setContentHeight(contentHeight);
    return dailyScrollingPanel;
  }

  if (!mainScrollingPanel) {
    mainScrollingPanel = new ScrollingPanel({ rect, contentHeight });
  }
  mainScrollingPanel.setRect(rect);
  mainScrollingPanel.setContentHeight(contentHeight);
  return mainScrollingPanel;
}

function drawQuestPanelFrame(rect: Rect) {
  const renderer = getActiveWebGLRenderer();
  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: cssToRgba(COLORS.panel.bg)
  });
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || "").trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}
