import { TabMenu, TabDefinition, Rect } from '../../components/tab-menu/tab-menu';
import { COLORS } from '../../../colors';
import { renderBasicShopTab, ShopActions } from './panels/basic-shop/index';
import { renderQuestsTab } from './panels/quests/render';
import { renderAchievementsTab } from './panels/achievements/render';
import { renderStatsTab } from './panels/stats/render';
import { drawLazyLoader } from '../../components/utils/lazy-loader';
import { InteractionState } from '../../managers/interactions';
import { ServerState } from '../../../net/snapshots';
import { GameChannel } from '../../../net/game-channel';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import { markViewed } from '../../../net/commands';
import {
  NOTICE_LEAF_TAB_ACHIEVEMENTS_BUTTON,
  NOTICE_LEAF_TAB_QUEST_BUTTON,
  NOTICE_LEAF_TAB_SHOP_BUTTON,
  NOTICE_PARENT_TAB_SHOP,
  NOTICE_PARENT_TAB_QUEST,
  NOTICE_PARENT_TAB_ACHIEVEMENTS
} from '../../managers/notices';

let tabMenu: TabMenu | null = null;
let shopActions: ShopActions | null = null;
let channel: GameChannel | null = null;
let runCommand: ((cmd: () => Promise<any>) => void) | null = null;

export function getTabMenu(): TabMenu {
  if (!tabMenu) {
    const tabs: TabDefinition[] = [
      {
        id: 'shop',
        label: 'Shop',
        hotkey: 'S',
        noticeParentId: NOTICE_PARENT_TAB_SHOP,
        noticeLeafId: NOTICE_LEAF_TAB_SHOP_BUTTON,
        renderContent: (canvas, input, state, rect) => {
          if (shopActions) {
            renderBasicShopTab(canvas, input, state, rect, shopActions);
          } else {
            drawLazyLoader(rect, 'Initializing Shop...');
          }
        }
      },
      {
        id: 'quest',
        label: 'Quest',
        hotkey: 'Q',
        noticeParentId: NOTICE_PARENT_TAB_QUEST,
        noticeLeafId: NOTICE_LEAF_TAB_QUEST_BUTTON,
        renderContent: renderQuestsTab
      },
      {
        id: 'achievements',
        label: 'Achievements',
        hotkey: 'A',
        noticeParentId: NOTICE_PARENT_TAB_ACHIEVEMENTS,
        noticeLeafId: NOTICE_LEAF_TAB_ACHIEVEMENTS_BUTTON,
        renderContent: renderAchievementsTab,
        onLeave: () => {
          if (channel && runCommand) {
            runCommand(() => markViewed(channel!, 'achievements'));
          }
        }
      },
      {
        id: 'stats',
        label: 'Stats',
        renderContent: renderStatsTab
      }
    ];

    tabMenu = new TabMenu(tabs, {
      layout: 'horizontal',
      position: 'top-left',
      tabHeight: 36,
      tabPadding: 24,
      contentGap: 4,
      font: 'bold 16px Arial'
    });
  }
  return tabMenu;
}

export function setShopActions(actions: ShopActions) {
  shopActions = actions;
}

export function getShopActions(): ShopActions | null {
  return shopActions;
}

export function setNetwork(newChannel: GameChannel, newRunCommand: (cmd: () => Promise<any>) => void) {
  channel = newChannel;
  runCommand = newRunCommand;
}

export function getNetwork() {
  return { channel, runCommand };
}
