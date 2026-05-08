import { Overlay } from '../overlay-manager';
import { COLORS } from '../../colors';
import { InputState, pointInRect } from '../input';
import { TabMenu, TabDefinition, Rect } from '../components/tab-menu/tab-menu';
import { renderSaveFilesTab } from '../features/save-files/save-files-tab';
import { SaveSlotActions } from '../components/cards/save-slot';
import {
  TOP_HUD_HEIGHT,
  BOTTOM_HUD_HEIGHT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_WIDTH,
} from '../../config';

export class MainMenu implements Overlay {
  private tabMenu: TabMenu;
  private actions: SaveSlotActions | null = null;

  public setActions(actions: SaveSlotActions) {
    this.actions = actions;
  }

  public setTab(id: string) {
    this.tabMenu.setActiveTabId(id);
  }

  public getActiveTabId(): string {
    return this.tabMenu.getActiveTabId();
  }

  constructor() {
    const renderPlaceholder = (title: string) => (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState, state: ServerState, rect: Rect) => {
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
          if (this.actions) {
            renderSaveFilesTab(ctx, canvas, input, state, rect, this.actions);
          } else {
            ctx.fillStyle = COLORS.panel.textPrimary;
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Actions not initialized', rect.x + rect.width / 2, rect.y + rect.height / 2);
          }
        }
      }
    ];

    this.tabMenu = new TabMenu(tabs, {
      layout: 'horizontal',
      position: 'top-left',
      tabHeight: 36,
      tabPadding: 24,
      font: 'bold 16px Arial'
    });
  }

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InputState, state: ServerState, onClose: () => void) {
    ctx.save();

    const x = DISPLAY_AREA_X;
    const y = TOP_HUD_HEIGHT;
    const width = DISPLAY_AREA_WIDTH;
    const height = canvas.height - TOP_HUD_HEIGHT - BOTTOM_HUD_HEIGHT;
    const shellRect = { x, y, width, height };

    ctx.fillStyle = COLORS.panel.bg;
    ctx.fillRect(x, y, width, height);
    
    ctx.restore();

    // Render TabMenu
    // We give it a slightly inset rect so it's not flush with the very edges
    const menuRect = {
      x: x + 16,
      y: y + 16,
      width: width - 32,
      height: height - 32
    };
    
    this.tabMenu.render(ctx, canvas, input, state, menuRect);

    if (!input.consumed) {
      if (pointInRect(input.pointer, shellRect)) {
        input.consumed = true;
      } else if (input.clicked) {
        onClose();
      }
    }
  }

  tick(dt: number) {
    this.tabMenu.tick(dt);
  }
}
