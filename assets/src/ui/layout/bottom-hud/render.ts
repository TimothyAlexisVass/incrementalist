import { COLORS } from "../../../colors";
import { BOTTOM_HUD_HEIGHT, DISPLAY_AREA_X, DISPLAY_AREA_WIDTH } from "../../../config";
import { doButton } from '../../components/button';
import { InteractionState } from '../../managers/interactions';
import { renderAreaDropdown } from '../../../features/areas/render';
import { drawLockedElement } from '../../components/locked-element';
import { doBonusTimeButton } from "../../components/bonustime-button";
import { GameChannel } from "../../../net/game-channel";
import type { GameSnapshot } from "../../../net/protocol";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { renderSeasonHud } from "../../season-hud/render";
import {
  NOTICE_PARENT_MENU_MAIN,
  notices
} from "../../managers/notices";

export function renderBottomHUD(
  canvas: HTMLCanvasElement, 
  input: InteractionState, 
  level: number,
  isMainMenuOpen: boolean,
  onMenuClick: () => void,
  onBonusTimeClick: () => void,
  onAreaSelect?: (areaKey: string) => void,
  channel?: GameChannel,
  hasBonusTimeToken?: boolean,
  bonusTooltip?: string[],
  isUnlocked?: boolean,
  runCommand?: (cmd: () => Promise<any>) => void,
  snapshot?: GameSnapshot | null
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
  const paddingBottom = (BOTTOM_HUD_HEIGHT - buttonHeight) / 2;
  
  const buttonX = canvas.width - buttonWidth - paddingRight;
  const buttonY = canvas.height - buttonHeight - paddingBottom;

  if (doButton(input, { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }, 'Menu [ESC]', {
    showNotice: !isMainMenuOpen && notices.hasParentNotice(NOTICE_PARENT_MENU_MAIN)
  })) {
    onMenuClick();
  }

  // Draw BONUSTIME button centered in DISPLAY_AREA
  const bonusWidth = 240;
  const bonusX = DISPLAY_AREA_X + (DISPLAY_AREA_WIDTH - bonusWidth) / 2;
  const bonusRect = { x: bonusX, y: buttonY, width: bonusWidth, height: buttonHeight };

  if (isUnlocked) {
    if (doBonusTimeButton(input, bonusRect, hasBonusTimeToken ?? false, bonusTooltip, "bonus-time-tooltip")) {
      onBonusTimeClick();
    }
  } else {
    drawLockedElement(canvas, input, bonusRect, () => {
      doBonusTimeButton(input, bonusRect, false, undefined, "bonus-time-tooltip");
    }, {
      label: "LOCKED",
      criteria: "Requires Bonus Time from Shop",
      font: "bold 13px Arial"
    });
  }

  // Draw season/time/weather HUD to the right of BONUSTIME.
  const seasonHudX = bonusRect.x + bonusRect.width + 150;
  const seasonHudWidth = Math.max(0, buttonX - 12 - seasonHudX);
  renderSeasonHud(
    canvas,
    { x: seasonHudX, y: buttonY, width: seasonHudWidth, height: buttonHeight },
    snapshot?.state?.climate
  );

  // Draw Area selection dropdown on the left
  renderAreaDropdown(canvas, input, (areaKey) => {
    if (onAreaSelect) onAreaSelect(areaKey);
  }, isMainMenuOpen, level, channel, runCommand);
}

function cssToRgba(color: string): [number, number, number, number] {
  const hex = String(color || "").trim().replace(/^#/, "");
  const expanded = hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return [1, 1, 1, 1];
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255, 1];
}
