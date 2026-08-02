import { COLORS } from "../../colors";
import { DISPLAY_AREA_X, DISPLAY_AREA_Y, DISPLAY_AREA_WIDTH, DISPLAY_AREA_HEIGHT, BOTTOM_HUD_HEIGHT, BOTTOM_HUD_BUTTON_FONT, HUD_LEFT_PADDING } from "../../config";
import { upgradeFurnace } from "../../net/commands";
import { renderSageArea } from "./sage/render";
import { getCloverfieldBackgroundBlendState } from "./cloverfield/render";
import { handleCloverfieldInteractions } from "./cloverfield/interactions";
import { renderOrchard, setOrchardPlantVisibility } from "./orchard/render";
import { handleOrchardInteractions } from "./orchard/interaction";
import { getAreaViewModel } from "./view-model";
import { InteractionState, pointInRect } from "../../ui/managers/interactions";
import { doButton, drawButton, drawNoticeDot } from "../../ui/components/button";
import { queueTooltip } from "../../ui/components/tooltip";
import { drawLockedElement } from "../../ui/components/locked-element";
import { FURNACE_MAX_LEVEL, FURNACE_MIN_LEVEL, formatUnlockRequirement } from "../requirements";
import {
  NOTICE_LEAF_AREA_DROPDOWN_BUTTON,
  NOTICE_PARENT_AREA_DROPDOWN,
  notices
} from "../../ui/managers/notices";
import { GameChannel } from "../../net/game-channel";
import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { resolveStableText } from "../../renderer/stable-text";
import { hexToRgba } from "../../utils/color";
import { drawLazyLoader } from "../../ui/components/utils/lazy-loader";
import { toNumber } from "../../core/bignum";
import { formatBigNum } from "../../utils/format";
import orchardSharedConfig from "../../../../shared/requirements/orchard.json";

const areaBackgroundImages = new Map<string, HTMLImageElement>();
const GO_TO_AREA_BUTTON_PADDING = 3;
const FURNACE_BURN_RATE_PER_MINUTE = orchardSharedConfig.soil.furnace.burn_rate_per_minute;
const FURNACE_POTASSIUM_PER_MINUTE =
  FURNACE_BURN_RATE_PER_MINUTE * orchardSharedConfig.soil.furnace.ash_yield_ratio;
const FURNACE_UPGRADE_BUTTON = {
  width: 120,
  height: 34,
  offsetX: 12,
  offsetY: 12
} as const;

function getAreaBackgroundImage(imageKey: string) {
  if (!areaBackgroundImages.has(imageKey)) {
    const image = new Image();
    image.src = `images/area/${imageKey}.png`;
    areaBackgroundImages.set(imageKey, image);
  }
  return areaBackgroundImages.get(imageKey)!;
}

export function renderAreaBackground(canvas: HTMLCanvasElement) {
  const renderer = getActiveWebGLRenderer();
  const model = getAreaViewModel();
  const areaKey = model.currentArea;

  if (areaKey === "cloverfield") {
    const blend = getCloverfieldBackgroundBlendState();
    const baseImage = getAreaBackgroundImage(`cloverfield-${blend.baseStage}`);
    const mixImage = blend.mixStage !== null ? getAreaBackgroundImage(`cloverfield-${blend.mixStage}`) : null;
    const hasBase = baseImage.complete && baseImage.naturalWidth > 0;
    const hasMix = mixImage !== null && mixImage.complete && mixImage.naturalWidth > 0;

    if (hasBase) {
      renderer.drawImage({
        image: baseImage,
        mixImage: hasMix ? mixImage : undefined,
        mixAmount: hasMix ? blend.mixAmount : 0,
        x: DISPLAY_AREA_X,
        y: DISPLAY_AREA_Y,
        width: DISPLAY_AREA_WIDTH,
        height: DISPLAY_AREA_HEIGHT
      });
      return;
    }

    if (hasMix && mixImage) {
      renderer.drawImage({
        image: mixImage,
        x: DISPLAY_AREA_X,
        y: DISPLAY_AREA_Y,
        width: DISPLAY_AREA_WIDTH,
        height: DISPLAY_AREA_HEIGHT
      });
      return;
    }
  } else {
    const areaImageKey = getAreaImageKey(areaKey, model.furnaceLevel);
    const image = getAreaBackgroundImage(areaImageKey);

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
  }

  const color = hexToRgba(COLORS.game.background);
  renderer.drawRect({ x: 0, y: 0, width: canvas.width, height: canvas.height, color });
}

function getAreaImageKey(areaKey: string, furnaceLevel: number): string {
  if (areaKey === "furnace") {
    const clampedLevel = Math.min(FURNACE_MAX_LEVEL, Math.max(FURNACE_MIN_LEVEL, furnaceLevel));
    return `furnace-${clampedLevel}`;
  }

  return areaKey.replace(/_/g, "-");
}

export function renderAreaSpecifics(
  canvas: HTMLCanvasElement, 
  input: InteractionState,
  level: number,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => Promise<any> | void,
  blocked: boolean = false
) {
  const model = getAreaViewModel();
  setOrchardPlantVisibility(model.currentArea === "orchard");

  if (model.currentArea === 'sage') {
    renderSageArea(canvas, input, level, channel, runCommand, blocked);
    return;
  }

  if (model.currentArea === "cloverfield") {
    handleCloverfieldInteractions(input, channel, runCommand, blocked);
    return;
  }

  if (model.currentArea === "orchard") {
    const isConnecting = channel ? channel.status !== "connected" : false;
    const orchardInput = (blocked || isConnecting) ? undefined : input;
    // Keep ambient harvest particles active even while modal input is blocked,
    // so particles remain visible behind semi-transparent overlays.
    renderOrchard(orchardInput, true);
    handleOrchardInteractions(input, channel, runCommand, blocked || isConnecting);

    if (isConnecting) {
      const renderer = getActiveWebGLRenderer();
      if (renderer) {
        // Dim the background slightly
        renderer.drawRect({
          x: DISPLAY_AREA_X,
          y: DISPLAY_AREA_Y,
          width: DISPLAY_AREA_WIDTH,
          height: DISPLAY_AREA_HEIGHT,
          color: [0, 0, 0, 0.6]
        });

        // Draw loading spinner/text
        drawLazyLoader({
          x: DISPLAY_AREA_X,
          y: DISPLAY_AREA_Y,
          width: DISPLAY_AREA_WIDTH,
          height: DISPLAY_AREA_HEIGHT
        }, "Connecting to Server...");
      }
    }
    return;
  }

  if (model.currentArea === "furnace") {
    renderFurnaceUpgradeButton(input, model.furnaceLevel, blocked, channel, runCommand);

    const furnace = model.furnace;
    if (furnace) {
      const renderer = getActiveWebGLRenderer();
      if (renderer) {
        const queueVal = toNumber(furnace.burn_queue);
        const isBurning = queueVal > 0;
        const x = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2;
        const panelW = 280;
        const panelH = 75;
        const panelX = x - panelW / 2;
        const panelY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT * 0.65;

        // Draw elegant glassmorphic panel
        renderer.drawRect({
          x: panelX,
          y: panelY,
          width: panelW,
          height: panelH,
          color: [0.03, 0.03, 0.05, 0.75]
        });

        // Draw subtle outline
        const borderCol: [number, number, number, number] = [0.4, 0.45, 0.5, 0.35];
        renderer.drawRect({ x: panelX, y: panelY, width: panelW, height: 1, color: borderCol });
        renderer.drawRect({ x: panelX, y: panelY + panelH - 1, width: panelW, height: 1, color: borderCol });
        renderer.drawRect({ x: panelX, y: panelY, width: 1, height: panelH, color: borderCol });
        renderer.drawRect({ x: panelX + panelW - 1, y: panelY, width: 1, height: panelH, color: borderCol });

        renderer.drawText({
          text: resolveStableText(
            "furnace.status",
            isBurning ? "Campfire Burning" : "Campfire Idle",
            {
              font: "bold 15px Arial",
              color: isBurning ? "#ff9f43" : COLORS.panel.textDisabled,
              align: "center",
              baseline: "top"
            }
          ),
          x,
          y: panelY + 12,
          font: "bold 15px Arial",
          color: isBurning ? "#ff9f43" : COLORS.panel.textDisabled,
          align: "center",
          baseline: "top"
        });

        renderer.drawText({
          text: resolveStableText(
            "furnace.burn_queue",
            `Queue: ${formatBigNum(furnace.burn_queue)} Plant Matter`,
            {
              font: "13px Arial",
              color: COLORS.panel.textPrimary,
              align: "center",
              baseline: "top"
            }
          ),
          x,
          y: panelY + 32,
          font: "13px Arial",
          color: COLORS.panel.textPrimary,
          align: "center",
          baseline: "top"
        });

        if (isBurning) {
          renderer.drawText({
            text: `Rate: ${FURNACE_BURN_RATE_PER_MINUTE.toFixed(1)} / min (+${FURNACE_POTASSIUM_PER_MINUTE.toFixed(2)} Potassium / min)`,
            x,
            y: panelY + 50,
            font: "12px Arial",
            color: "#10b981",
            align: "center",
            baseline: "top"
          });
        }
      }
    }
  }
}

function renderFurnaceUpgradeButton(
  input: InteractionState,
  furnaceLevel: number,
  blocked: boolean,
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => Promise<any> | void
) {
  const rect = {
    x: DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - FURNACE_UPGRADE_BUTTON.width - FURNACE_UPGRADE_BUTTON.offsetX,
    y: DISPLAY_AREA_Y + FURNACE_UPGRADE_BUTTON.offsetY,
    width: FURNACE_UPGRADE_BUTTON.width,
    height: FURNACE_UPGRADE_BUTTON.height
  };
  const canUpgrade = furnaceLevel < FURNACE_MAX_LEVEL;

  if (canUpgrade && !blocked && channel && runCommand) {
    if (doButton(input, rect, "Upgrade", { font: BOTTOM_HUD_BUTTON_FONT })) {
      runCommand(() => upgradeFurnace(channel));
    }
    return;
  }

  const isHovered = pointInRect(input.pointer, rect);
  const label = canUpgrade ? "Upgrade" : "Max Level";

  drawButton(rect, label, {
    active: isHovered,
    font: BOTTOM_HUD_BUTTON_FONT,
    inactiveSurface: COLORS.panel.bg,
    inactiveBorder: COLORS.panel.border,
    textColor: canUpgrade ? COLORS.panel.textPrimary : COLORS.panel.textDisabled
  });
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
    showNotice: !isMainMenuOpen && notices.hasParentNotice(NOTICE_PARENT_AREA_DROPDOWN)
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
  const layout = getAreaDropdownLayout(canvas);

  if (isDropdownOpen) {
    renderDropdownItems(canvas, input, layout, onSelect, level, channel, runCommand);
  }

  // Draw the main button's notice dot above the main menu so its animation is not clipped/covered.
  if (notices.hasParentNotice(NOTICE_PARENT_AREA_DROPDOWN)) {
    drawNoticeDot(layout.buttonRect.x + layout.buttonRect.width - 1, layout.buttonRect.y + 1, 4);
  }
}

function getAreaDropdownLayout(canvas: HTMLCanvasElement) {
  const model = getAreaViewModel();
  const buttonWidth = 140;
  const buttonHeight = 34;
  const paddingBottom = (BOTTOM_HUD_HEIGHT - buttonHeight) / 2;
  const buttonX = HUD_LEFT_PADDING + GO_TO_AREA_BUTTON_PADDING;
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
        font: BOTTOM_HUD_BUTTON_FONT,
        activeSurface: COLORS.button.surface.active,
        inactiveSurface: COLORS.panel.bg,
        activeBorder: COLORS.panel.border,
        inactiveBorder: COLORS.panel.border,
        textColor: area.is_locked ? COLORS.panel.textDisabled : COLORS.panel.textPrimary
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
        criteria: area.lock_reason || formatUnlockRequirement(area.unlock_level, level)
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

  // Render dropdown notices in a dedicated pass so they always sit above all buttons in the list.
  layout.availableAreas.forEach((area, i) => {
    const leafId = `leaf.area.${area.key}.go_button`;
    const hasNotice = notices.hasLeafNotice(leafId);
    if (!hasNotice) return;

    const itemRect = {
      x: layout.menuRect.x,
      y: layout.menuRect.y + i * layout.paddedItemHeight,
      width: layout.menuRect.width,
      height: layout.paddedItemHeight
    };

    drawNoticeDot(itemRect.x + itemRect.width - 1, itemRect.y + 1, 4);
  });
}
