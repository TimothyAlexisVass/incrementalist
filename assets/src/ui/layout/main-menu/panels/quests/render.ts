import { COLORS } from '../../../../../colors';
import { ServerState } from '../../../../../net/snapshots';
import { getActiveWebGLRenderer } from '../../../../../renderer/webgl';
import { drawNoticeDot } from '../../../../components/button';
import { drawQuestCard, getQuestNoticeAnchor } from '../../../../components/cards/quest';
import { ScrollingPanel } from '../../../../components/scrolling-panel';
import { Rect, TabDefinition, TabMenu } from '../../../../components/tab-menu/tab-menu';
import { InteractionState } from '../../../../managers/interactions';
import { getQuestViewModel } from './view-model';
import { handleQuestInteractions } from './interactions';
import { QuestState, GameSnapshot } from '../../../../../net/protocol';
import { getNetwork } from '../../view-model';
import { markViewed } from '../../../../../net/commands';
import { notices } from '../../../../managers/notices';
import { formatNumberRatio } from '../../../../../utils';
import { toNumber } from '../../../../../core/bignum';
import { resolveUpdatingText } from '../../../../../utils/text';
import { ZERO } from '../../../../../core/bignum';
import { drawHorizontalBar, getHorizontalBarCenterY } from '../../../../components/bar';
import { getQuestFameBarRect, setQuestFameBarContainerRect } from '../../../../../features/quests/fame-bar';
import {
  TOP_HUD_LEVEL_FONT,
  TOP_HUD_EXP_FONT,
  QUEST_FAME_BAR_TRUST_GAP
} from '../../../../../config';
import {
  NOTICE_LEAF_TAB_QUEST_DAILY_BUTTON,
  NOTICE_LEAF_TAB_QUEST_MAIN_BUTTON,
  NOTICE_PARENT_TAB_QUEST_DAILY,
  NOTICE_PARENT_TAB_QUEST_MAIN
} from '../../../../managers/notices';

const CARD_HEIGHT_PX = 92;
const CARD_GAP_PX = 12;
const CARD_SCROLLBAR_GUTTER_PX = 12;
const FAME_BAR_TEXT_KEY = "quests.fame_bar.text";
const FAME_BAR_TRUST_TEXT_KEY = "quests.fame_bar.trust";
const FAME_BAR_FILL_LERP_FACTOR = 0.2;

let questSubTabs: TabMenu | null = null;
let dailyScrollingPanel: ScrollingPanel | null = null;
let mainScrollingPanel: ScrollingPanel | null = null;
let lastViewedSnapshot: GameSnapshot | null = null;
let displayedFameFillRatio = 0;
let hasFameFillInitialized = false;

export function renderQuestsTab(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState,
  rect: Rect
) {
  const snapshot = state.snapshot;
  if (snapshot && snapshot !== lastViewedSnapshot && !snapshot.state.stats.screens_viewed_quests) {
    lastViewedSnapshot = snapshot;
    const { channel } = getNetwork();
    if (channel) {
      markViewed(channel, 'quests');
    }
  }

  drawQuestPanelFrame(rect);
  setQuestFameBarContainerRect(rect);
  if (snapshot) {
    drawFameBar(snapshot, rect);
  }
  const viewModel = getQuestViewModel(state);
  const { channel, runCommand } = getNetwork();
  getQuestSubTabs(viewModel).render(canvas, input, state, rect, channel || undefined, runCommand || undefined);
}

function getQuestSubTabs(viewModel: any): TabMenu {
  if (!questSubTabs) {
    const tabs: TabDefinition[] = [
      {
        id: 'main',
        label: 'Main',
        noticeParentId: NOTICE_PARENT_TAB_QUEST_MAIN,
        noticeLeafId: NOTICE_LEAF_TAB_QUEST_MAIN_BUTTON,
        renderContent: (_canvas, input, state, rect) => {
          const vm = getQuestViewModel(state);
          renderQuestList(input, rect, vm.mainQuests, 'main');
        }
      },
      {
        id: 'daily',
        label: 'Daily',
        noticeParentId: NOTICE_PARENT_TAB_QUEST_DAILY,
        noticeLeafId: NOTICE_LEAF_TAB_QUEST_DAILY_BUTTON,
        renderContent: (_canvas, input, state, rect) => {
          const vm = getQuestViewModel(state);
          renderQuestList(input, rect, vm.dailyQuests, 'daily');
        }
      },
    ];

    questSubTabs = new TabMenu(tabs, {
      layout: 'horizontal',
      position: 'top-left',
      tabHeight: 32,
      tabPadding: 18,
      gap: 6,
      contentMargin: 5,
      font: 'bold 14px Arial'
    }, 'main');
  }

  return questSubTabs;
}

function renderQuestList(
  input: InteractionState,
  rect: Rect,
  quests: QuestState[],
  panelKey: 'daily' | 'main'
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const listRect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  };

  const cardWidth = Math.max(1, listRect.width - CARD_SCROLLBAR_GUTTER_PX);
  const contentHeight = (quests.length * CARD_HEIGHT_PX) + (Math.max(0, quests.length - 1) * CARD_GAP_PX);
  const scrollingPanel = getScrollingPanel(panelKey, listRect, contentHeight);
  const noticeOverlays: Array<{ leafId: string; x: number; y: number; radius: number }> = [];
  const { channel, runCommand } = getNetwork();

  scrollingPanel.update(input);
  const scrollOffsetY = scrollingPanel.getScrollOffset();

  handleQuestInteractions(input, quests, listRect, scrollOffsetY, cardWidth, CARD_HEIGHT_PX, CARD_GAP_PX);

  scrollingPanel.drawClippedContent(renderer, (offsetY) => {
    const startY = listRect.y - offsetY;
    for (let i = 0; i < quests.length; i++) {
      const quest = quests[i];
      const cardY = startY + (i * (CARD_HEIGHT_PX + CARD_GAP_PX));

      if (cardY >= listRect.y + listRect.height) break;
      if (cardY + CARD_HEIGHT_PX <= listRect.y) continue;

      const cardRect = {
        x: listRect.x,
        y: cardY,
        width: cardWidth,
        height: CARD_HEIGHT_PX
      };
      drawQuestCard({
        quest,
        rect: cardRect,
        channel: channel || undefined,
        runCommand: runCommand || undefined,
        showNotice: false
      });

      const leafId = `leaf.quest.${(quest as any).id}.claim_button`;
      if (quest.rank > quest.claimed_rank && notices.hasLeafNotice(leafId)) {
        const anchor = getQuestNoticeAnchor(cardRect);
        noticeOverlays.push({ leafId, x: anchor.x, y: anchor.y, radius: anchor.radius });
      }
    }
  });

  scrollingPanel.drawScrollBar(renderer);

  for (const overlay of noticeOverlays) {
    drawNoticeDot(overlay.x, overlay.y, overlay.radius);
    notices.reportLeafVisible(overlay.leafId, true, channel || undefined, runCommand || undefined);
  }
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
  if (!renderer) return;
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

function drawFameBar(snapshot: GameSnapshot, rect: Rect) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const barRect = getQuestFameBarRect(rect);
  const trust = Math.max(1, snapshot.state.trust || 1);
  const fame = snapshot.state.fame || ZERO;
  const requiredFame = snapshot.state.required_fame || { m: 2, e: 1 };
  const fillRatio = Math.min(1, Math.max(0, toNumber(fame) / Math.max(1, toNumber(requiredFame))));
  if (!hasFameFillInitialized) {
    displayedFameFillRatio = fillRatio;
    hasFameFillInitialized = true;
  } else {
    displayedFameFillRatio += (fillRatio - displayedFameFillRatio) * FAME_BAR_FILL_LERP_FACTOR;
  }
  displayedFameFillRatio = Math.min(1, Math.max(0, displayedFameFillRatio));

  drawHorizontalBar(
    barRect,
    {
      fillRatio: displayedFameFillRatio,
      fillStartColor: COLORS.bar.fame.fillStart,
      fillEndColor: COLORS.bar.fame.fillEnd
    }
  );

  const trustText = resolveUpdatingText(
    FAME_BAR_TRUST_TEXT_KEY,
    String(trust),
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_LEVEL_FONT,
      color: COLORS.panel.textPrimary,
      align: 'right',
      baseline: 'middle'
    })
  );
  renderer.drawText({
    text: trustText,
    x: barRect.x - QUEST_FAME_BAR_TRUST_GAP,
    y: getHorizontalBarCenterY(barRect),
    font: TOP_HUD_LEVEL_FONT,
    color: COLORS.panel.textPrimary,
    align: 'right',
    baseline: 'middle'
  });

  const fameText = resolveUpdatingText(
    FAME_BAR_TEXT_KEY,
    `${formatNumberRatio(fame, requiredFame)} FAME`,
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: TOP_HUD_EXP_FONT,
      color: COLORS.panel.textPrimary,
      align: 'center',
      baseline: 'middle'
    })
  );
  renderer.drawText({
    text: fameText,
    x: barRect.x + barRect.width / 2,
    y: getHorizontalBarCenterY(barRect),
    font: TOP_HUD_EXP_FONT,
    color: COLORS.panel.textPrimary,
    align: 'center',
    baseline: 'middle'
  });
}
