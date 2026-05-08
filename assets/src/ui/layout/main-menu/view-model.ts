import { TabMenu, TabDefinition, Rect } from '../../components/tab-menu/tab-menu';
import { SaveSlotActions } from '../../components/cards/save-slot';
import { COLORS } from '../../../colors';
import { renderSaveFilesTab } from './panels/save-files';
import { InteractionState } from '../../interaction-manager';
import { ServerState } from '../../../net/snapshots';

let tabMenu: TabMenu | null = null;
let saveSlotActions: SaveSlotActions | null = null;

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
        renderContent: renderPlaceholder('Shop')
      },
      {
        id: 'quest',
        label: 'Quest',
        hotkey: 'Q',
        renderContent: renderPlaceholder('Quest')
      },
      {
        id: 'achievements',
        label: 'Achievements',
        hotkey: 'A',
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
