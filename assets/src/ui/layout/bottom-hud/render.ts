import { COLORS } from "../../../colors";
import { BOTTOM_HUD_HEIGHT } from "../../../config";
import { doButton } from '../../components/button';
import { InteractionState } from '../../managers/interactions';
import { renderAreaDropdown } from '../../../features/areas/render';
import { GameChannel } from "../../../net/game-channel";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import {
  NOTICE_PARENT_MENU_MAIN,
  notices
} from "../../managers/notices";

export function renderBottomHUD(
  canvas: HTMLCanvasElement, 
  input: InteractionState, 
  isMainMenuOpen: boolean,
  onMenuClick: () => void,
  onAreaSelect?: (areaKey: string) => void,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  renderer.drawRect({
    x: 0,
    y: canvas.height - BOTTOM_HUD_HEIGHT,
    width: canvas.width,
    height: BOTTOM_HUD_HEIGHT,
    color: cssToRgba(COLORS.panel.bg)
  });

  const buttonWidth = 120;
  const buttonHeight = 34;
  const paddingRight = 20;
  const paddingBottom = (BOTTOM_HUD_HEIGHT - buttonHeight) / 2; // Center vertically in HUD
  
  const buttonX = canvas.width - buttonWidth - paddingRight;
  const buttonY = canvas.height - buttonHeight - paddingBottom;

  if (doButton(input, { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }, 'Menu [ESC]', {
    showNotice: !isMainMenuOpen && notices.hasParentNotice(NOTICE_PARENT_MENU_MAIN)
  })) {
    onMenuClick();
  }

  // Draw Area selection dropdown on the left
  renderAreaDropdown(canvas, input, (areaKey) => {
    if (onAreaSelect) onAreaSelect(areaKey);
  }, channel, runCommand);
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || "").trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}
