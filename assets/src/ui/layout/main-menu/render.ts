import { Overlay } from '../../managers/overlays';
import { COLORS } from '../../../colors';
import { InteractionState } from '../../managers/interactions';
import { ServerState } from '../../../net/snapshots';
import { SaveSlotActions } from '../../components/cards/save-slot';
import {
  TOP_HUD_HEIGHT,
  BOTTOM_HUD_HEIGHT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_WIDTH,
} from '../../../config';
import { getTabMenu, setSaveSlotActions, setShopActions, getNetwork } from './view-model';
import { ShopActions } from './panels/basic-shop/index';
import { handleMainMenuInteractions } from './interactions';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

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
    const renderer = getActiveWebGLRenderer();
    if (!renderer) {
      return;
    }

    const x = DISPLAY_AREA_X;
    const y = TOP_HUD_HEIGHT;
    const width = DISPLAY_AREA_WIDTH;
    const height = canvas.height - TOP_HUD_HEIGHT - BOTTOM_HUD_HEIGHT;
    const shellRect = { x, y, width, height };

    renderer.drawRect({
      x,
      y,
      width,
      height,
      color: cssToRgba(COLORS.panel.bg)
    });

    // Render TabMenu
    // We give it a slightly inset rect so it's not flush with the very edges
    const menuRect = {
      x: x + 16,
      y: y + 16,
      width: width - 32,
      height: height - 32
    };
    
    const { channel, runCommand } = getNetwork();
    getTabMenu().render(ctx, canvas, input, state, menuRect, channel || undefined, runCommand || undefined);

    handleMainMenuInteractions(input, shellRect, onClose);
  }

  tick(dt: number) {
    getTabMenu().tick(dt);
  }
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || "").trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}
