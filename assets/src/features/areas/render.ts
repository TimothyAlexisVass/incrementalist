import { COLORS } from "../../colors";
import { DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT, BOTTOM_HUD_HEIGHT, BOTTOM_HUD_BUTTON_FONT } from "../../config";
import { renderSageArea } from "./sage/render";
import { getAreaViewModel } from "./view-model";
import { InteractionState, pointInRect } from "../../ui/interaction-manager";
import { doButton, drawNoticeDot } from "../../ui/components/button";
import { drawLockedElement } from "../../ui/components/locked-element";
import { noticeSystem } from "../../ui/notice-system";
import { GameChannel } from "../../net/game-channel";

const areaBackgroundImages = new Map<string, HTMLImageElement>();

function getAreaBackgroundImage(areaKey: string) {
  if (!areaBackgroundImages.has(areaKey)) {
    const image = new Image();
    image.src = `images/${areaKey}_background.png`;
    areaBackgroundImages.set(areaKey, image);
  }
  return areaBackgroundImages.get(areaKey)!;
}

export function renderAreaBackground(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const model = getAreaViewModel();
  const areaKey = model.currentArea;
  
  const image = getAreaBackgroundImage(areaKey);

  if (image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT);
    return;
  }

  ctx.fillStyle = COLORS.game.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function renderAreaSpecifics(
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement, 
  input: InteractionState,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const model = getAreaViewModel();
  if (model.currentArea === 'sage') {
    renderSageArea(ctx, canvas, input, level, channel, runCommand);
  }
}

// Dropdown UI state
let isDropdownOpen = false;
let hoveredAreaKey: string | null = null;

export function renderAreaDropdown(
  ctx: CanvasRenderingContext2D, 
  canvas: HTMLCanvasElement, 
  input: InteractionState, 
  onSelect: (areaKey: string) => void
) {
  const model = getAreaViewModel();
  const buttonWidth = 140;
  const buttonHeight = 34;
  const paddingBottom = (BOTTOM_HUD_HEIGHT - buttonHeight) / 2;
  const buttonX = 20;
  const buttonY = canvas.height - buttonHeight - paddingBottom;
  
  const currentArea = model.availableAreas.find(a => a.key === model.currentArea);
  const buttonLabel = currentArea ? currentArea.name : 'Unknown Area';

  const buttonRect = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };

  // Handle hover for dropdown
  const isHoveringButton = pointInRect(input.pointer, buttonRect);
  if (isHoveringButton) {
    isDropdownOpen = true;
  }

  if (isDropdownOpen) {
    const availableAreas = model.availableAreas.filter(a => a.key !== model.currentArea);
    if (availableAreas.length > 0) {
      const itemHeight = 34;
      const menuWidth = buttonWidth;
      const menuHeight = availableAreas.length * itemHeight;
      const menuRect = { x: buttonX, y: buttonY - menuHeight, width: menuWidth, height: menuHeight };

      const isHoveringMenu = pointInRect(input.pointer, menuRect);
      if (!isHoveringButton && !isHoveringMenu) {
        isDropdownOpen = false;
      } else {
        // Render menu background
        ctx.save();
        ctx.fillStyle = COLORS.panel.bg;
        ctx.fillRect(menuRect.x, menuRect.y, menuRect.width, menuRect.height);
        ctx.strokeStyle = COLORS.panel.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(menuRect.x + 0.5, menuRect.y + 0.5, menuRect.width - 1, menuRect.height - 1);

        availableAreas.forEach((area, i) => {
          const itemRect = { 
            x: menuRect.x, 
            y: menuRect.y + i * itemHeight, 
            width: menuWidth, 
            height: itemHeight 
          };
          
          const isHovered = pointInRect(input.pointer, itemRect);
          
          const renderItem = () => {
            // Draw item background if hovered (only if not locked, or we can show hover anyway)
            if (isHovered && !area.is_locked) {
              ctx.fillStyle = COLORS.panel.highlight;
              ctx.fillRect(itemRect.x, itemRect.y, itemRect.width, itemRect.height);
            }

            ctx.fillStyle = area.is_locked ? COLORS.panel.textDisabled : COLORS.panel.textPrimary;
            ctx.font = BOTTOM_HUD_BUTTON_FONT;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.textBaseline = 'middle';
            ctx.fillText(area.name, itemRect.x + itemRect.width / 2, itemRect.y + itemRect.height / 2);

            // Show dot if new area or new sage tip
            const hasNotice = noticeSystem.hasLeafNotice(`area:${area.key}`) || (area.key === 'sage' && noticeSystem.hasSageNotice());
            if (hasNotice) {
              drawNoticeDot(ctx, itemRect.x + itemRect.width - 10, itemRect.y + 10);
            }
          };

          if (area.is_locked) {
            drawLockedElement(ctx, canvas, input, itemRect, renderItem, {
              criteria: `Requires Level ${area.unlock_level}`
            });
          } else {
            renderItem();
          }

          if (isHovered && input.clicked && !area.is_locked) {
            onSelect(area.key);
            isDropdownOpen = false;
            input.consumed = true;
          }
        });
        ctx.restore();
      }
    }
  }

  // Draw the main button
  if (doButton(ctx, input, buttonRect, buttonLabel, {
    showNotice: noticeSystem.hasAreaNotice()
  })) {
    // Click also toggles or handles selection if needed, but hover handles open.
  }
}
