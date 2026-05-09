import { COLORS } from "../../../colors";
import { BOTTOM_HUD_HEIGHT } from "../../../config";
import { doButton } from '../../components/button';
import { InteractionState } from '../../interaction-manager';
import { renderAreaDropdown } from '../../../features/areas/render';
import { noticeSystem } from "../../notice-system";

export function renderBottomHUD(
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement, 
  input: InteractionState, 
  isMainMenuOpen: boolean,
  onMenuClick: () => void,
  onAreaSelect?: (areaKey: string) => void
) {
  ctx.save();

  // Draw background for bottom HUD
  ctx.fillStyle = COLORS.panel.bg;
  ctx.fillRect(0, canvas.height - BOTTOM_HUD_HEIGHT, canvas.width, BOTTOM_HUD_HEIGHT);

  const buttonWidth = 120;
  const buttonHeight = 34;
  const paddingRight = 20;
  const paddingBottom = (BOTTOM_HUD_HEIGHT - buttonHeight) / 2; // Center vertically in HUD
  
  const buttonX = canvas.width - buttonWidth - paddingRight;
  const buttonY = canvas.height - buttonHeight - paddingBottom;

  if (doButton(ctx, input, { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight }, 'Menu [ESC]', {
    showNotice: !isMainMenuOpen && noticeSystem.hasMenuNotice()
  })) {
    onMenuClick();
  }

  // Draw Area selection dropdown on the left
  renderAreaDropdown(ctx, canvas, input, (areaKey) => {
    if (onAreaSelect) onAreaSelect(areaKey);
  });

  ctx.restore();
}
