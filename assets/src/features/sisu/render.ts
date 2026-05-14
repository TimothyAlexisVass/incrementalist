import { COLORS } from "../../colors";
import {
  SISU_MAX_FONT,
  SISU_METER_FONT,
  SISU_METER_RADIUS,
  SISU_METER_THICKNESS,
  SISU_UPGRADE_BUTTON_FONT,
  TINY_TEXT_FONT,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_HEIGHT
} from "../../config";
import type { BigNum } from "../../core/bignum";
import type { GameChannel } from "../../net/game-channel";
import type { ServerResult } from "../../net/protocol";
import type { ServerState } from "../../net/snapshots";
import { drawCurrencyAmount, measureCurrencyAmount } from "../../render/currency-icons";
import { drawButton } from "../../ui/components/button";
import { notices } from "../../ui/managers/notices";
import { InteractionState, pointInRect } from "../../ui/managers/interactions";
import type { Modal } from "../../ui/managers/modals";
import { drawLockedElement } from "../../ui/components/locked-element";
import { clampNumber } from "../../utils";
import { formatCountRatio, formatNumber, formatSisuMultiplier } from "../../utils/format";
import { getProgressBarLayout } from "../progress-bar/render";
import { formatUnlockRequirement, getShopItemRequiredLevel } from "../requirements";
import { getActiveWebGLRenderer, WebGLRenderer, RGBA } from "../../renderer/webgl";
import { hexToRgba } from "../../utils/color";
import { queueTooltip } from "../../ui/components/tooltip";
import { renderSisuCrystal, type SisuCrystalTier } from "./crystal";

let sisuModalBackgroundImage: HTMLImageElement | null = null;
function getSisuModalBackgroundImage() {
  if (!sisuModalBackgroundImage) {
    sisuModalBackgroundImage = new Image();
    sisuModalBackgroundImage.src = "images/sisu_modal.png";
  }
  return sisuModalBackgroundImage;
}


import { handleSisuModalInteractions, type SisuRefillHitRect } from "./interactions";
import {
  getSisuControlRect,
  getChargeCrystalCount,
  getSisuTierTarget,
  getUpgradeButtonState,
  SISU_BASE_MAX,
  SISU_MAX_UPGRADE_LEVEL,
  SISU_MIN_MULTIPLIER,
  SISU_REFILL_TIERS,
  toFiniteBigNumNumber,
  updateSisuVisualProjection,
  type Rect
} from "./view-model";

export type SisuControlLayout = {
  controlRect: Rect;
};

export { getSisuControlRect };

const SISU_MULTIPLIER_TEXT_KEY = "sisu.control.multiplier";
const SISU_GLASS_BALL_RADIUS = 32;

export function renderSisuControl(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState
): SisuControlLayout | null {
  const renderer = getActiveWebGLRenderer();
  const snapshot = state.snapshot;
  if (!snapshot) return null;

  const controlRect = getSisuControlRect(canvas);
  const { displayCurrent } = updateSisuVisualProjection(snapshot);
  const isUnlocked = Boolean(snapshot.state.features.sisu_generator_purchased);
  const sisuRequiredLevel = getShopItemRequiredLevel(snapshot.state.shop, "sisu_generator");

  const progressBar = getProgressBarLayout(canvas);
  const centerX = progressBar.x + progressBar.width / 2;
  const centerY = progressBar.y + progressBar.height + 120;
  const barRadius = SISU_METER_RADIUS;

  const drawNative = () => {
    drawSisuControlNative(renderer, input, controlRect, snapshot, centerX, centerY, barRadius, displayCurrent);
  };

  if (!isUnlocked) {
    drawLockedElement(canvas, input, controlRect, drawNative, {
      font: SISU_METER_FONT,
      criteria: formatUnlockRequirement(sisuRequiredLevel),
      showNotice: notices.hasLeafNotice("leaf.feature.sisu_generator.locked_text"),
      showNoticePing: true,
      shape: "circle",
      padding: 8
    });
  } else {
    drawNative();
  }

  return { controlRect };
}

export function renderSisuGlassBallOverlay(
  canvas: HTMLCanvasElement,
  state: ServerState
) {
  const renderer = getActiveWebGLRenderer();
  const snapshot = state.snapshot;
  if (!renderer || !snapshot) return;

  const progressBar = getProgressBarLayout(canvas);
  const centerX = progressBar.x + progressBar.width / 2;
  const centerY = progressBar.y + progressBar.height + 120;
  const radius = SISU_GLASS_BALL_RADIUS;

  // Transparent glass body.
  renderer.drawCircle(centerX, centerY, radius, [0.804, 0.91, 1, 0.085], 0.14);

  // Inner refraction shadow for depth.
  renderer.drawCircle(
    centerX + radius * 0.16,
    centerY + radius * 0.12,
    radius * 0.8,
    [0.039, 0.086, 0.149, 0.075],
    0.42
  );

  // Crisp rim and glossy highlights.
  renderer.drawRing(centerX, centerY, radius - 1, 1.5, [0.882, 0.957, 1, 0.26], 0.3);
  renderer.drawArc(
    centerX - radius * 0.04,
    centerY - radius * 0.05,
    radius * 0.98,
    radius * 0.045,
    -2.75 - Math.PI / 6,
    -0.94 - Math.PI / 6,
    [1, 1, 1, 0.286],
    0.75,
    "additive"
  );
  renderer.drawArc(
    centerX - radius * 0.04,
    centerY - radius * 0.05,
    radius * 0.9,
    radius * 0.05,
    -2.45 - Math.PI / 6,
    -1.14 - Math.PI / 6,
    [1, 1, 1, 0.286],
    0.02,
    "additive"
  );
  renderer.drawCircle(
    centerX - radius * 0.48,
    centerY - radius * 0.43,
    radius * 0.13,
    [1, 1, 1, 0.34],
    0.9,
    "additive"
  );
  renderer.drawCircle(
    centerX - radius * 0.28,
    centerY - radius * 0.6,
    radius * 0.06,
    [1, 1, 1, 0.54],
    0.9,
    "additive"
  );
  renderer.drawCircle(
    centerX - radius * 0.38,
    centerY - radius * 0.5,
    radius * 0.28,
    [1, 1, 1, 0.24],
    0.5,
    "additive"
  );
  renderer.drawArc(
    centerX + radius * 0.05,
    centerY + radius * 0.04,
    radius * 0.86,
    radius * 0.035,
    -0.05,
    1.75,
    [0.588, 0.824, 1, 0.24],
    0.62,
    "additive"
  );
}

function drawSisuControlNative(
  renderer: WebGLRenderer,
  input: InteractionState,
  controlRect: Rect,
  snapshot: any,
  centerX: number,
  centerY: number,
  barRadius: number,
  displayCurrent: number
) {
  const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));
  const blueMax = getSisuTierTarget(maxBasic, "azure");
  const aetherMax = getSisuTierTarget(maxBasic, "aether");
  const orangeMax = getSisuTierTarget(maxBasic, "lucent");
  const whiteMax = getSisuTierTarget(maxBasic, "transcendent");
  const startAngle = -Math.PI / 2;
  const fullCircle = Math.PI * 2;

  const getTierFillRatio = (value: number, tierMin: number, tierMax: number) => {
    if (tierMax <= tierMin) return value >= tierMax ? 1 : 0;
    return clampNumber((value - tierMin) / (tierMax - tierMin), 0, 1);
  };

  const showSisuHoverInfo = Boolean(snapshot.state.features.sisu_generator_purchased);
  const activeTier = snapshot.state.sisu.active_tier;
  const crystalTier: SisuCrystalTier =
    activeTier === "aether" ||
      activeTier === "lucent" ||
      activeTier === "transcendent" ||
      activeTier === "azure"
      ? activeTier
      : "azure";

  // Crystal goes behind the meter.
  if (showSisuHoverInfo && displayCurrent > 1) {
    renderSisuCrystal(renderer, centerX, centerY, 40, crystalTier);
  }

  // Border/Track
  renderer.drawRing(centerX, centerY, barRadius, SISU_METER_THICKNESS, hexToRgba(COLORS.bar.track));

  // Blue Tier
  const blueFillRatio = getTierFillRatio(displayCurrent, SISU_MIN_MULTIPLIER, blueMax);
  if (blueFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * blueFillRatio, hexToRgba(COLORS.sisu.blue));
  }

  // Aether Tier
  const aetherFillRatio = getTierFillRatio(displayCurrent, blueMax, aetherMax);
  if (aetherFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * aetherFillRatio, hexToRgba(COLORS.sisu.purple));
  }

  // Lucent Tier
  const lucentFillRatio = getTierFillRatio(displayCurrent, aetherMax, orangeMax);
  if (lucentFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * lucentFillRatio, hexToRgba(COLORS.sisu.orange));
  }

  // Transcendent Tier
  const transcendentFillRatio = getTierFillRatio(displayCurrent, orangeMax, whiteMax);
  if (transcendentFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * transcendentFillRatio, hexToRgba(COLORS.sisu.white));
  }

  // Multiplier Tooltip
  if (showSisuHoverInfo && input.pointer && pointInRect(input.pointer, controlRect)) {
    const tooltipText = `Sisu Multiplier: x${displayCurrent.toFixed(displayCurrent >= 10 ? 1 : 2)}`;
    queueTooltip(input.pointer, tooltipText, {
      widthMode: 'estimated',
      estimatedWidthFactor: displayCurrent >= 10 ? 0.46 : 0.45,
      textUpdateKey: SISU_MULTIPLIER_TEXT_KEY
    });
  }
}

export function createSisuGeneratorModal(
  getState: () => ServerState,
  channel: GameChannel,
  runCommand: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null>,
  onClose: () => void
): Modal {
  return new SisuGeneratorModalImpl(getState, channel, runCommand, onClose);
}

class SisuGeneratorModalImpl implements Modal {
  private readonly refillRects: SisuRefillHitRect[] = [];
  private modalRect: Rect | null = null;
  private upgradeRect: Rect | null = null;
  public readonly backdropAlpha = 0;
  public readonly closeOnMenuButton = true;

  constructor(
    private readonly getState: () => ServerState,
    private readonly channel: GameChannel,
    private readonly runCommand: (cmd: () => Promise<ServerResult>) => Promise<ServerResult | null>,
    private readonly onClose: () => void
  ) { }

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    const renderer = getActiveWebGLRenderer();
    const snapshot = this.getState().snapshot;
    if (!snapshot || !snapshot.state.features.sisu_generator_purchased) {
      this.onClose();
      return;
    }

    const bgImage = getSisuModalBackgroundImage();
    const isImageReady = bgImage.complete && bgImage.naturalWidth > 0;

    // Scale the image down slightly to fit better.
    const scale = 0.57;
    const modalWidth = isImageReady ? bgImage.naturalWidth * scale : 560;
    const modalHeight = isImageReady ? bgImage.naturalHeight * scale : 224;

    const modalX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - modalWidth;
    const modalY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT - modalHeight;

    this.modalRect = { x: modalX, y: modalY, width: modalWidth, height: modalHeight };

    if (isImageReady) {
      renderer.drawImage({
        image: bgImage,
        x: modalX,
        y: modalY,
        width: modalWidth,
        height: modalHeight
      });
    } else {
      renderer.drawRect({ ...this.modalRect, color: hexToRgba(COLORS.panel.bg) });
      drawRectOutline(renderer, this.modalRect, 2, hexToRgba(COLORS.overlay.panelBorder));
    }

    const { displayCurrent } = updateSisuVisualProjection(snapshot);
    const currentSisu = Math.max(SISU_MIN_MULTIPLIER, displayCurrent);
    const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));
    const chargeCrystals = snapshot.state.charge_crystals;

    this.refillRects.length = 0;

    if (isImageReady) {
      // Scaled coordinates from 1003x771 source image:
      // Ornate Frames (Azure, Aether, Lucent, Transcendent):
      // - Width: 186px, Height: 520px
      // - Start Y: 230px, Start X: 104px
      // - Spacing between frame origins: ~204px
      const frameW = 186 * scale;
      const frameH = 520 * scale;
      const frameY = modalY + 230 * scale;
      const startX = modalX + 104 * scale;
      const frameGap = (308 - 104 - 186) * scale; // gap between frame x starts

      for (let index = 0; index < SISU_REFILL_TIERS.length; index += 1) {
        const tier = SISU_REFILL_TIERS[index];
        const target = getSisuTierTarget(maxBasic, tier.id);
        const availableCount = getChargeCrystalCount(chargeCrystals, tier.id);
        const enabled = availableCount > 0 && currentSisu < target;
        const rect = {
          x: startX + index * (frameW + frameGap),
          y: frameY,
          width: frameW,
          height: frameH
        };
        this.refillRects.push({ tier: tier.id, rect, enabled });
        drawSisuRefillControl(renderer, input, rect, tier.label, tier.colorKey, target, currentSisu, availableCount, enabled, true);
      }

      // Upgrade Button (BOOST CHARGE) alignment:
      this.upgradeRect = {
        x: modalX + 510 * scale,
        y: modalY + 620 * scale,
        width: 410 * scale,
        height: 120 * scale
      };
    } else {
      const refillWidth = 120;
      const refillHeight = 96;
      const refillGap = 14;
      const totalRefillWidth = refillWidth * SISU_REFILL_TIERS.length + refillGap * (SISU_REFILL_TIERS.length - 1);
      const refillStartX = modalX + Math.floor((modalWidth - totalRefillWidth) / 2);
      const refillY = modalY + 40;

      for (let index = 0; index < SISU_REFILL_TIERS.length; index += 1) {
        const tier = SISU_REFILL_TIERS[index];
        const target = getSisuTierTarget(maxBasic, tier.id);
        const availableCount = getChargeCrystalCount(chargeCrystals, tier.id);
        const enabled = availableCount > 0 && currentSisu < target;
        const rect = {
          x: refillStartX + index * (refillWidth + refillGap),
          y: refillY,
          width: refillWidth,
          height: refillHeight
        };
        this.refillRects.push({ tier: tier.id, rect, enabled });
        drawSisuRefillControl(renderer, input, rect, tier.label, tier.colorKey, target, currentSisu, availableCount, enabled, false);
      }

      this.upgradeRect = {
        x: modalX + modalWidth - 180 - 22,
        y: refillY + refillHeight + 16,
        width: 180,
        height: 36
      };
    }

    const maxUpgradeLevel = snapshot.state.sisu.max_upgrade_level || 0;
    const maxSisuText = `Base ${formatSisuMultiplier(maxBasic)}(Level ${formatCountRatio(maxUpgradeLevel, SISU_MAX_UPGRADE_LEVEL)})`;

    // Max Sisu text positioned above the first frame (Azure)
    renderer.drawText({
      text: maxSisuText,
      x: modalX + 40,
      y: modalY + 385,
      font: SISU_MAX_FONT,
      color: COLORS.hud.textPrimary,
      align: "left",
      baseline: "middle",
      strokeColor: "black",
      strokeWidth: 2
    });

    const upgradeState = getUpgradeButtonState(snapshot.state.shards, maxUpgradeLevel);
    const isUpgradeActive = !upgradeState.disabled && this.upgradeRect && pointInRect(input.pointer, this.upgradeRect);

    if (isImageReady) {
      // We still draw the cost and label over the image button.
      // Boost Charge text is already in the image? Let's check.
      // Yes, "BOOST CHARGE" is in the image.
      // We just need to draw the cost.
    } else {
      drawButton(this.upgradeRect, upgradeState.label, {
        active: isUpgradeActive,
        activeSurface: upgradeState.disabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
        inactiveSurface: upgradeState.disabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
        activeBorder: upgradeState.disabled ? COLORS.button.secondary.border : COLORS.button.border.active,
        inactiveBorder: upgradeState.disabled ? COLORS.button.secondary.border : COLORS.button.border.active,
        textColor: COLORS.button.text,
        font: SISU_UPGRADE_BUTTON_FONT,
        textY: this.upgradeRect.y + 23
      });
    }

    const pendingUpgradeCost = upgradeState.cost;
    const pendingUpgradePrefix = upgradeState.prefix;

    if (pendingUpgradeCost !== null) {
      // If image is ready, draw cost below or above the button?
      // In the image, "BOOST CHARGE" is in the middle of the button.
      // I'll draw the cost below it.
      if (isImageReady) {
        drawUpgradeCostLabel(this.upgradeRect, null, pendingUpgradeCost, this.upgradeRect.y + this.upgradeRect.height - 20);
      } else {
        drawUpgradeCostLabel(this.upgradeRect, pendingUpgradePrefix, pendingUpgradeCost);
      }
    }

    handleSisuModalInteractions(
      input,
      this.modalRect,
      this.upgradeRect,
      !upgradeState.disabled,
      this.refillRects,
      this.channel,
      this.runCommand,
      this.onClose
    );
  }


  tick(_dt: number, _input: InteractionState) {
    // Reactive-only modal.
  }
}

function drawUpgradeCostLabel(rect: Rect, prefix: string | null, cost: BigNum, overrideY?: number) {
  const renderer = getActiveWebGLRenderer();
  const textY = overrideY ?? rect.y + 63;
  const iconSize = 18;
  const iconGap = 4;
  const currencyKey = "shards";
  const textColor = COLORS.button.text;
  const leftText = prefix ? `${prefix} (` : "";
  const rightText = prefix ? ")" : "";

  const leftWidth = leftText
    ? renderer.measureTextWidth({ text: leftText, font: SISU_UPGRADE_BUTTON_FONT })
    : 0;
  const amountWidth = measureCurrencyAmount(cost, iconSize, {
    font: SISU_UPGRADE_BUTTON_FONT,
    iconGap
  });
  const rightWidth = rightText
    ? renderer.measureTextWidth({ text: rightText, font: SISU_UPGRADE_BUTTON_FONT })
    : 0;
  const totalWidth = leftWidth + amountWidth + rightWidth;
  let currentX = rect.x + rect.width / 2 - totalWidth / 2;

  if (leftText) {
    renderer.drawText({
      text: leftText,
      x: currentX + 40,
      y: textY,
      font: SISU_UPGRADE_BUTTON_FONT,
      color: textColor,
      align: "left",
      baseline: "alphabetic"
    });
    currentX += leftWidth;
  }

  drawCurrencyAmount(currencyKey, cost, currentX, textY, iconSize, {
    align: "left",
    font: SISU_UPGRADE_BUTTON_FONT,
    textColor,
    iconGap,
    formatter: formatNumber
  });
  currentX += amountWidth;

  if (rightText) {
    renderer.drawText({
      text: rightText,
      x: currentX,
      y: textY,
      font: SISU_UPGRADE_BUTTON_FONT,
      color: textColor,
      align: "left",
      baseline: "alphabetic"
    });
  }
}

function drawRectOutline(renderer: WebGLRenderer, rect: Rect, width: number, color: RGBA) {
  renderer.drawRect({ x: rect.x, y: rect.y, width: rect.width, height: width, color });
  renderer.drawRect({ x: rect.x, y: rect.y + rect.height - width, width: rect.width, height: width, color });
  renderer.drawRect({ x: rect.x, y: rect.y, width: width, height: rect.height, color });
  renderer.drawRect({ x: rect.x + rect.width - width, y: rect.y, width: width, height: rect.height, color });
}

function drawSisuRefillControl(
  renderer: WebGLRenderer,
  input: InteractionState,
  rect: Rect,
  label: string,
  colorKey: "blue" | "purple" | "orange" | "white",
  target: number,
  currentSisu: number,
  availableCount: number,
  enabled: boolean,
  minimal: boolean
) {
  const canRefill = enabled && currentSisu < target;
  const isHovered = canRefill && pointInRect(input.pointer, rect);
  const tierColor = COLORS.sisu[colorKey];

  if (!minimal) {
    const surfaceColor = canRefill
      ? (isHovered ? COLORS.button.surface.active : COLORS.button.surface.active)
      : COLORS.button.secondary.surface;
    renderer.drawRect({ ...rect, color: hexToRgba(surfaceColor) });

    const borderColor = canRefill ? tierColor : COLORS.button.secondary.border;
    drawRectOutline(renderer, rect, isHovered ? 3 : 2, hexToRgba(borderColor));
  }

  const circleX = rect.x + rect.width / 2;
  // Crystal center: ~45% down the frame in minimal/image mode
  const circleY = minimal ? rect.y + rect.height * 0.45 : rect.y + 28;

  if (canRefill && isHovered) {
    renderer.drawCircle(circleX, circleY, minimal ? 32 : 16, [1, 1, 1, 0.2], 0.8, "additive");
  }

  // Large crystal visual for minimal/image mode.
  if (minimal) {
    const crystalTier = colorKey === "blue" ? "azure" : colorKey === "purple" ? "aether" : colorKey === "orange" ? "lucent" : "transcendent";
    renderSisuCrystal(renderer, circleX, circleY, 50, crystalTier);
  } else {
    renderer.drawCircle(circleX, circleY, 14, hexToRgba(tierColor), 0.15);
    renderer.drawRing(circleX, circleY, 14, 1.5, hexToRgba(COLORS.button.text));

    renderer.drawText({
      text: label,
      x: circleX,
      y: rect.y + 60,
      font: SISU_METER_FONT,
      color: COLORS.button.text,
      align: "center",
      baseline: "middle"
    });
  }

  // Text labels positioned relative to the frame height
  const textYOffset = minimal ? rect.height * 0.75 : 82; // Target multiplier at ~75%
  const countYOffset = minimal ? rect.height * 0.15 : 16; // Crystal count at ~15%

  renderer.drawText({
    text: `x${formatNumber(availableCount)}`,
    x: minimal ? circleX : rect.x + rect.width - 10,
    y: rect.y + countYOffset,
    font: TINY_TEXT_FONT,
    color: canRefill ? COLORS.button.text : COLORS.button.secondary.text,
    align: minimal ? "center" : "right",
    baseline: "middle"
  });

  const targetText = formatSisuMultiplier(target);
  renderer.drawText({
    text: targetText,
    x: circleX,
    y: rect.y + textYOffset,
    font: TINY_TEXT_FONT,
    color: COLORS.button.text,
    align: "center",
    baseline: "middle",
    strokeColor: "black",
    strokeWidth: 2
  });
}
