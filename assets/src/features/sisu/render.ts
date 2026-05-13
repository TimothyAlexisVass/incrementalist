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
import { resolveUpdatingText } from "../../utils/text";
import { getProgressBarLayout } from "../progress-bar/render";
import { formatUnlockRequirement, getShopItemRequiredLevel } from "../requirements";
import { getActiveWebGLRenderer, WebGLRenderer, RGBA } from "../../renderer/webgl";
import { hexToRgba } from "../../utils/color";

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
    drawSisuControlNative(renderer, snapshot, centerX, centerY, barRadius, displayCurrent);
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

function drawSisuControlNative(
  renderer: WebGLRenderer,
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

  // Center Multiplier Text
  const text = resolveUpdatingText(
    SISU_MULTIPLIER_TEXT_KEY,
    displayCurrent.toFixed(displayCurrent >= 10 ? 1 : 2),
    (candidate) => renderer.isTextReady({
      text: candidate,
      font: SISU_MAX_FONT,
      color: COLORS.hud.textPrimary,
      align: "center",
      baseline: "middle",
      strokeColor: "black",
      strokeWidth: 1
    })
  );
  renderer.drawText({
    text,
    x: centerX,
    y: centerY,
    font: SISU_MAX_FONT,
    color: COLORS.hud.textPrimary,
    align: "center",
    baseline: "middle",
    strokeColor: "black",
    strokeWidth: 1
  });
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
  public readonly backdropAlpha = 0.3;
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

    const modalWidth = 560;
    const modalHeight = 224;
    const modalX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - modalWidth;
    const modalY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT - modalHeight;

    this.modalRect = { x: modalX, y: modalY, width: modalWidth, height: modalHeight };

    renderer.drawRect({ ...this.modalRect, color: hexToRgba(COLORS.panel.bg) });
    drawRectOutline(renderer, this.modalRect, 2, hexToRgba(COLORS.overlay.panelBorder));

    const { displayCurrent } = updateSisuVisualProjection(snapshot);
    const currentSisu = Math.max(SISU_MIN_MULTIPLIER, displayCurrent);
    const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));
    const chargeCrystals = snapshot.state.charge_crystals;

    this.refillRects.length = 0;
    const refillWidth = 120;
    const refillHeight = 96;
    const refillGap = 14;
    const refillToUpgradeGap = 16;
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
      drawSisuRefillControl(renderer, input, rect, tier.label, tier.colorKey, target, currentSisu, availableCount, enabled);
    }

    const maxUpgradeLevel = snapshot.state.sisu.max_upgrade_level || 0;
    const maxSisuText = `Max Sisu: ${formatSisuMultiplier(maxBasic)} (Level ${formatCountRatio(maxUpgradeLevel, SISU_MAX_UPGRADE_LEVEL)})`;
    renderer.drawText({
      text: maxSisuText,
      x: modalX + 18,
      y: modalY + 168,
      font: SISU_MAX_FONT,
      color: COLORS.hud.textPrimary,
      align: "left",
      baseline: "middle",
      strokeColor: "black",
      strokeWidth: 2
    });

    this.upgradeRect = {
      x: modalX + modalWidth - 180 - 22,
      y: refillY + refillHeight + refillToUpgradeGap,
      width: 180,
      height: 36
    };

    const upgradeState = getUpgradeButtonState(snapshot.state.shards, maxUpgradeLevel);
    const isUpgradeActive = !upgradeState.disabled && this.upgradeRect && pointInRect(input.pointer, this.upgradeRect);
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

    const pendingUpgradeCost = upgradeState.cost;
    const pendingUpgradePrefix = upgradeState.prefix;

    if (pendingUpgradeCost !== null) {
      drawUpgradeCostLabel(this.upgradeRect, pendingUpgradePrefix, pendingUpgradeCost);
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

function drawUpgradeCostLabel(rect: Rect, prefix: string | null, cost: BigNum) {
  const renderer = getActiveWebGLRenderer();
  const textY = rect.y + 23;
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
      x: currentX,
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
  enabled: boolean
) {
  const canRefill = enabled && currentSisu < target;
  const isHovered = canRefill && pointInRect(input.pointer, rect);
  const tierColor = COLORS.sisu[colorKey];

  const surfaceColor = canRefill
    ? (isHovered ? COLORS.button.surface.active : COLORS.button.surface.active)
    : COLORS.button.secondary.surface;
  renderer.drawRect({ ...rect, color: hexToRgba(surfaceColor) });

  const borderColor = canRefill ? tierColor : COLORS.button.secondary.border;
  drawRectOutline(renderer, rect, isHovered ? 3 : 2, hexToRgba(borderColor));

  const circleX = rect.x + rect.width / 2;
  const circleY = rect.y + 28;

  if (canRefill && isHovered) {
    renderer.drawCircle(circleX, circleY, 16, [1, 1, 1, 0.2], 0.8, "additive");
  }

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

  renderer.drawText({
    text: `x${formatNumber(availableCount)}`,
    x: rect.x + rect.width - 10,
    y: rect.y + 16,
    font: TINY_TEXT_FONT,
    color: canRefill ? COLORS.button.text : COLORS.button.secondary.text,
    align: "right",
    baseline: "middle"
  });

  const targetText = formatSisuMultiplier(target);
  renderer.drawText({
    text: targetText,
    x: circleX,
    y: rect.y + 82,
    font: TINY_TEXT_FONT,
    color: COLORS.button.text,
    align: "center",
    baseline: "middle",
    strokeColor: "black",
    strokeWidth: 2
  });
}
