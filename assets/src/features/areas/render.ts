import { COLORS } from "../../colors";
import { DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT, BOTTOM_HUD_HEIGHT, BOTTOM_HUD_BUTTON_FONT } from "../../config";
import { renderSageArea } from "./sage/render";
import { getAreaViewModel } from "./view-model";
import { InteractionState, pointInRect } from "../../ui/managers/interactions";
import { doButton, drawButton, drawNoticeDot } from "../../ui/components/button";
import { queueTooltip } from "../../ui/components/tooltip";
import { drawLockedElement } from "../../ui/components/locked-element";
import { formatUnlockRequirement } from "../requirements";
import {
  NOTICE_LEAF_AREA_DROPDOWN_BUTTON,
  NOTICE_PARENT_AREA_DROPDOWN,
  notices
} from "../../ui/managers/notices";
import { GameChannel } from "../../net/game-channel";
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { hexToRgba } from "../../utils/color";

const areaBackgroundImages = new Map<string, HTMLImageElement>();
const GO_TO_AREA_BUTTON_PADDING = 3;

function getAreaBackgroundImage(areaKey: string) {
  if (!areaBackgroundImages.has(areaKey)) {
    const image = new Image();
    image.src = `images/${areaKey}_background.png`;
    areaBackgroundImages.set(areaKey, image);
  }
  return areaBackgroundImages.get(areaKey)!;
}

export function renderAreaBackground(canvas: HTMLCanvasElement) {
  const renderer = getActiveWebGLRenderer();
  const model = getAreaViewModel();
  const areaKey = model.currentArea;
  
  const image = getAreaBackgroundImage(areaKey);

  if (image.complete && image.naturalWidth > 0) {
    renderer.drawImage({
      image,
      x: DISPLAY_AREA_X,
      y: DISPLAY_AREA_Y,
      width: DISPLAY_AREA_WIDTH,
      height: DISPLAY_AREA_HEIGHT
    });
    return;
  }



  const color = hexToRgba(COLORS.game.background);
  renderer.drawRect({ x: 0, y: 0, width: canvas.width, height: canvas.height, color });
}

export function renderAreaSpecifics(
  canvas: HTMLCanvasElement, 
  input: InteractionState,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const model = getAreaViewModel();
  if (model.currentArea === 'sage') {
    renderSageArea(canvas, input, level, channel, runCommand);
  }
}

// Dropdown UI state
let isDropdownOpen = false;

export function closeAreaDropdown() {
  isDropdownOpen = false;
}

export function renderAreaDropdown(
  canvas: HTMLCanvasElement, 
  input: InteractionState, 
  onSelect: (areaKey: string) => void,
  isMainMenuOpen: boolean,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const layout = getAreaDropdownLayout(canvas);

  // Handle hover for dropdown
  const isHoveringButton = pointInRect(input.pointer, layout.buttonRect);
  if (isHoveringButton) {
    isDropdownOpen = true;
  }

  if (isDropdownOpen) {
    const isHoveringMenu = pointInRect(input.pointer, layout.menuRect);
    if (!isHoveringButton && !isHoveringMenu) {
      isDropdownOpen = false;
    } else {
      notices.reportParentVisibleViaPseudoLeaf(
        NOTICE_LEAF_AREA_DROPDOWN_BUTTON,
        NOTICE_PARENT_AREA_DROPDOWN,
        true,
        channel,
        runCommand
      );

      if (!isMainMenuOpen) {
        renderDropdownItems(canvas, input, layout, onSelect, level, channel, runCommand);
      }
    }
  }

  // Draw the main button
  if (doButton(input, layout.buttonRect, layout.buttonLabel, {
    showNotice: notices.hasParentNotice(NOTICE_PARENT_AREA_DROPDOWN)
  })) {
    // Click also toggles or handles selection if needed, but hover handles open.
  }
}

export function renderAreaDropdownAboveMenu(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  onSelect: (areaKey: string) => void,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  if (!isDropdownOpen) return;

  const layout = getAreaDropdownLayout(canvas);
  renderDropdownItems(canvas, input, layout, onSelect, level, channel, runCommand);
}

function getAreaDropdownLayout(canvas: HTMLCanvasElement) {
  const model = getAreaViewModel();
  const buttonWidth = 140;
  const buttonHeight = 34;
  const paddingBottom = (BOTTOM_HUD_HEIGHT - buttonHeight) / 2;
  const buttonX = 20;
  const buttonY = canvas.height - buttonHeight - paddingBottom;
  const currentArea = model.availableAreas.find(a => a.key === model.currentArea);
  const buttonLabel = currentArea ? currentArea.name : 'Unknown Area';
  const buttonRect = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
  const availableAreas = model.availableAreas.filter(a => a.key !== model.currentArea);
  const itemHeight = 34;
  const menuWidth = buttonWidth + GO_TO_AREA_BUTTON_PADDING * 2;
  const paddedItemHeight = itemHeight + GO_TO_AREA_BUTTON_PADDING * 2;
  const menuHeight = availableAreas.length * paddedItemHeight + 9;
  const menuRect = {
    x: buttonX - GO_TO_AREA_BUTTON_PADDING,
    y: buttonY - menuHeight,
    width: menuWidth,
    height: menuHeight
  };

  return { buttonRect, buttonLabel, availableAreas, menuRect, paddedItemHeight };
}

function renderDropdownItems(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  layout: ReturnType<typeof getAreaDropdownLayout>,
  onSelect: (areaKey: string) => void,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  if (layout.availableAreas.length === 0) {
    return;
  }

  layout.availableAreas.forEach((area, i) => {
    const itemRect = {
      x: layout.menuRect.x,
      y: layout.menuRect.y + i * layout.paddedItemHeight,
      width: layout.menuRect.width,
      height: layout.paddedItemHeight
    };

    const isHovered = pointInRect(input.pointer, itemRect);

    const leafId = `leaf.area.${area.key}.go_button`;
    const hasNotice = notices.hasLeafNotice(leafId);

    const renderItem = () => {
      drawButton(itemRect, area.is_locked ? "" : area.name, {
        active: isHovered,
        padding: 0,
        font: BOTTOM_HUD_BUTTON_FONT,
        activeSurface: COLORS.button.surface.active,
        inactiveSurface: COLORS.panel.bg,
        activeBorder: COLORS.panel.border,
        inactiveBorder: COLORS.panel.border,
        textColor: area.is_locked ? COLORS.panel.textDisabled : COLORS.panel.textPrimary,
        showNotice: !area.is_locked && hasNotice // Button draws its own notice if not locked
      });

      if (hasNotice) {
        notices.reportLeafVisible(leafId, true, channel, runCommand);
      }
    };

    if (area.is_locked) {
      // Keep the same full-size row visuals as unlocked items, then
      // overlay lock labeling/tooltip behavior without shrinking/dimming the shell.
      drawLockedElement(canvas, input, itemRect, renderItem, {
        opacity: 0,
        criteria: formatUnlockRequirement(area.unlock_level, level),
        showNotice: hasNotice,
        showNoticePing: true
      });
    } else {
      renderItem();
      if (isHovered && area.description) {
        queueTooltip(input.pointer!, area.description);
      }
    }

    const startedInside = pointInRect(input.pressStartPointer, itemRect);
    if (isHovered && startedInside && input.clicked && !area.is_locked) {
      notices.reportLeafClicked(`leaf.area.${area.key}.go_button`, channel, runCommand);
      onSelect(area.key);
      isDropdownOpen = false;
      input.consumed = true;
    }
  });
}
