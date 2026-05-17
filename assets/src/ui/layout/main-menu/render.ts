import { Overlay } from '../../managers/overlays';
import { COLORS } from '../../../colors';
import { InteractionState } from '../../managers/interactions';
import { ServerState } from '../../../net/snapshots';
import {
  TOP_HUD_HEIGHT,
  BOTTOM_HUD_HEIGHT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_WIDTH,
  HUD_LEFT_PADDING
} from '../../../config';
import { getTabMenu, setShopActions, getNetwork } from './view-model';
import { ShopActions } from './panels/basic-shop/index';
import { handleMainMenuInteractions } from './interactions';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

export class MainMenu implements Overlay {
  public setShopActions(actions: ShopActions) {
    setShopActions(actions);
  }

  public setTab(id: string) {
    getTabMenu().setActiveTabId(id);
  }

  public getActiveTabId(): string {
    return getTabMenu().getActiveTabId();
  }

  render(canvas: HTMLCanvasElement, input: InteractionState, state: ServerState, onClose: () => void) {
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

    const menuRect = {
      x: shellRect.x + HUD_LEFT_PADDING,
      y: shellRect.y,
      width: shellRect.width - HUD_LEFT_PADDING,
      height: shellRect.height
    };
    
    const { channel, runCommand } = getNetwork();
    getTabMenu().render(canvas, input, state, menuRect, channel || undefined, runCommand || undefined);

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
