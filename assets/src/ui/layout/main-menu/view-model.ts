import { TabMenu, TabDefinition, Rect } from '../../components/tab-menu/tab-menu';
import { SaveSlotActions } from '../../components/cards/save-slot';
import { COLORS } from '../../../colors';
import { renderSaveFilesTab } from './panels/save-files';
import { renderBasicShopTab, ShopActions } from './panels/basic-shop/index';
import { drawLazyLoader } from '../../components/utils/lazy-loader';
import { InteractionState } from '../../interaction-manager';
import { ServerState } from '../../../net/snapshots';
import { GameChannel } from '../../../net/game-channel';

let tabMenu: TabMenu | null = null;
let saveSlotActions: SaveSlotActions | null = null;
let shopActions: ShopActions | null = null;
let channel: GameChannel | null = null;
let runCommand: ((cmd: () => Promise<any>) => void) | null = null;

export function getTabMenu(): TabMenu {
  if (!tabMenu) {
    const renderPlaceholder = (title: string) => (ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, _input: InteractionState, _state: ServerState, rect: Rect) => {
      ctx.fillStyle = COLORS.panel.textPrimary;
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${title} Placeholder`, rect.x + rect.width / 2, rect.y + rect.height / 2);
    };

    const tabs: TabDefinition[] = [
      {
        id: 'shop',
        label: 'Shop',
        hotkey: 'S',
        noticeType: 'shop_item',
        noticeParentId: 'shop_tab',
        renderContent: (ctx, canvas, input, state, rect) => {
          if (shopActions) {
            renderBasicShopTab(ctx, canvas, input, state, rect, shopActions);
          } else {
            drawLazyLoader(ctx, rect, 'Initializing Shop...');
          }
        }
      },
      {
        id: 'quest',
        label: 'Quest',
        hotkey: 'Q',
        noticeType: 'quest',
        noticeParentId: 'quest_tab',
        renderContent: renderPlaceholder('Quest')
      },
      {
        id: 'achievements',
        label: 'Achievements',
        hotkey: 'A',
        noticeType: 'achievement',
        noticeParentId: 'achievement_tab',
        renderContent: renderPlaceholder('Achievements')
      },
      {
        id: 'stats',
        label: 'Stats',
        renderContent: renderPlaceholder('Stats')
      },
      {
        id: 'save',
        label: 'Save Files',
        renderContent: (ctx, canvas, input, state, rect) => {
          if (saveSlotActions) {
            renderSaveFilesTab(ctx, canvas, input, state, rect, saveSlotActions);
          } else {
            ctx.fillStyle = COLORS.panel.textPrimary;
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Actions not initialized', rect.x + rect.width / 2, rect.y + rect.height / 2);
          }
        }
      }
    ];

    tabMenu = new TabMenu(tabs, {
      layout: 'horizontal',
      position: 'top-left',
      tabHeight: 36,
      tabPadding: 24,
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
