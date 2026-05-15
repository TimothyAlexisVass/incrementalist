import { TabMenu, TabDefinition, Rect } from '../../components/tab-menu/tab-menu';
import { SaveSlotActions } from '../../components/cards/save-slot';
import { COLORS } from '../../../colors';
import { renderSaveFilesTab } from './panels/save-files';
import { renderBasicShopTab, ShopActions } from './panels/basic-shop/index';
import { renderQuestsTab } from './panels/quests/render';
import { renderAchievementsTab } from './panels/achievements/render';
import { drawLazyLoader } from '../../components/utils/lazy-loader';
import { InteractionState } from '../../managers/interactions';
import { ServerState } from '../../../net/snapshots';
import { GameChannel } from '../../../net/game-channel';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';
import {
  NOTICE_LEAF_TAB_ACHIEVEMENTS_BUTTON,
  NOTICE_LEAF_TAB_QUEST_BUTTON,
  NOTICE_LEAF_TAB_SHOP_BUTTON,
  NOTICE_PARENT_TAB_SHOP
} from '../../managers/notices';

let tabMenu: TabMenu | null = null;
let saveSlotActions: SaveSlotActions | null = null;
let shopActions: ShopActions | null = null;
let channel: GameChannel | null = null;
let runCommand: ((cmd: () => Promise<any>) => void) | null = null;

export function getTabMenu(): TabMenu {
  if (!tabMenu) {
    const renderPlaceholder = (title: string) => (_canvas: HTMLCanvasElement, _input: InteractionState, _state: ServerState, rect: Rect) => {
      const renderer = getActiveWebGLRenderer();
      if (!renderer) return;
      renderer.drawText({
        text: `${title} Placeholder`,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        font: '24px Arial',
        color: COLORS.panel.textPrimary,
        align: 'center',
        baseline: 'middle'
      });
    };

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
        noticeLeafId: NOTICE_LEAF_TAB_QUEST_BUTTON,
        renderContent: renderQuestsTab
      },
      {
        id: 'achievements',
        label: 'Achievements',
        hotkey: 'A',
        noticeLeafId: NOTICE_LEAF_TAB_ACHIEVEMENTS_BUTTON,
        renderContent: renderAchievementsTab
      },
      {
        id: 'stats',
        label: 'Stats',
        renderContent: renderPlaceholder('Stats')
      },
      {
        id: 'save',
        label: 'Save Files',
        renderContent: (canvas, input, state, rect) => {
          if (saveSlotActions) {
            renderSaveFilesTab(canvas, input, state, rect, saveSlotActions);
          } else {
            const renderer = getActiveWebGLRenderer();
            if (renderer) {
              renderer.drawText({
                text: 'Actions not initialized',
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
                font: '18px Arial',
                color: COLORS.panel.textPrimary,
                align: 'center',
                baseline: 'middle'
              });
            }
          }
        }
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

export function setSaveSlotActions(actions: SaveSlotActions) {
  saveSlotActions = actions;
}

export function getSaveSlotActions(): SaveSlotActions | null {
  return saveSlotActions;
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
