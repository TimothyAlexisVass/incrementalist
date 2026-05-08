import { Overlay } from '../../overlay-manager';
import { COLORS } from '../../../colors';
import { InteractionState } from '../../interaction-manager';
import { ServerState } from '../../../net/snapshots';
import { SaveSlotActions } from '../../components/cards/save-slot';
import {
  TOP_HUD_HEIGHT,
  BOTTOM_HUD_HEIGHT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_WIDTH,
} from '../../../config';
import { getTabMenu, setSaveSlotActions, setShopActions } from './view-model';
import { ShopActions } from './panels/basic-shop/index';
import { handleMainMenuInteractions } from './interactions';

export class MainMenu implements Overlay {
  public setActions(actions: SaveSlotActions) {
    setSaveSlotActions(actions);
  }

  public setShopActions(actions: ShopActions) {
    setShopActions(actions);
  }

  public setTab(id: string) {
    getTabMenu().setActiveTabId(id);
  }

  public getActiveTabId(): string {
    return getTabMenu().getActiveTabId();
  }

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState, state: ServerState, onClose: () => void) {
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
    
    getTabMenu().render(ctx, canvas, input, state, menuRect);

    handleMainMenuInteractions(input, shellRect, onClose);
  }

  tick(dt: number) {
    getTabMenu().tick(dt);
  }
}
