import { COLORS } from "../../colors";
import {
  SISU_CURRENT_FONT,
  SISU_MAX_FONT,
  SISU_METER_FONT,
  SISU_METER_RADIUS,
  SISU_UPGRADE_BUTTON_FONT,
  TINY_TEXT_FONT
} from "../../config";
import type { BigNum } from "../../core/bignum";
import type { GameChannel } from "../../net/game-channel";
import type { ServerResult } from "../../net/protocol";
import type { ServerState } from "../../net/snapshots";
import { drawCurrencyAmount, measureCurrencyAmount } from "../../render/currency-icons";
import { drawButton } from "../../ui/components/button";
import { notices } from "../../ui/managers/notices";
import { InteractionState } from "../../ui/managers/interactions";
import type { Modal } from "../../ui/managers/modals";
import { drawLockedElement } from "../../ui/components/locked-element";
import { clampNumber } from "../../utils";
import { formatCountRatio, formatNumber, formatSisuMultiplier } from "../../utils/format";
import { getProgressBarLayout } from "../progress-bar/render";
import { getActiveWebGLRenderer, WebGLRenderer, RGBA } from "../../renderer/webgl";
import { hexToRgba } from "../../utils/color";

import { handleSisuModalInteractions, type SisuRefillHitRect } from "./interactions";
import {
  getSisuControlRect,
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
  sisuBlitted?: boolean;
};

export { getSisuControlRect };

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
      showNotice: notices.hasLeafNotice("leaf.feature.sisu_generator.locked_text"),
      showNoticePing: true,
      shape: "circle",
      padding: 8
    });
  } else {
    drawNative();
  }

  return { controlRect, sisuBlitted: true };
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
  const blueMax = getSisuTierTarget(maxBasic, "blue");
  const yellowMax = getSisuTierTarget(maxBasic, "yellow");
  const purpleMax = getSisuTierTarget(maxBasic, "purple");
  const startAngle = -Math.PI / 2;
  const fullCircle = Math.PI * 2;

  const getTierFillRatio = (value: number, tierMin: number, tierMax: number) => {
    if (tierMax <= tierMin) return value >= tierMax ? 1 : 0;
    return clampNumber((value - tierMin) / (tierMax - tierMin), 0, 1);
  };

  // Border/Track
  renderer.drawRing(centerX, centerY, barRadius, 14, hexToRgba(COLORS.bar.border));
  renderer.drawRing(centerX, centerY, barRadius, 12, hexToRgba(COLORS.bar.track));

  // Blue Tier
  const blueFillRatio = getTierFillRatio(displayCurrent, SISU_MIN_MULTIPLIER, blueMax);
  if (blueFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, 10, startAngle, startAngle + fullCircle * blueFillRatio, hexToRgba(COLORS.sisu.blue));
  }

  // Yellow Tier
  const yellowFillRatio = getTierFillRatio(displayCurrent, blueMax, yellowMax);
  if (yellowFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, 10, startAngle, startAngle + fullCircle * yellowFillRatio, hexToRgba(COLORS.sisu.yellow));
  }

  // Purple Tier
  const purpleFillRatio = getTierFillRatio(displayCurrent, yellowMax, purpleMax);
  if (purpleFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, 10, startAngle, startAngle + fullCircle * purpleFillRatio, hexToRgba(COLORS.sisu.purple));
  }

  // Center Multiplier Text
  const text = displayCurrent.toFixed(2);
  renderer.drawText({
    text,
    x: centerX,
    y: centerY,
    font: SISU_MAX_FONT,
    color: COLORS.hud.textPrimary,
    align: "center",
    baseline: "middle",
    strokeColor: "black",
    strokeWidth: 5
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
  private closeRect: Rect | null = null;
  private upgradeRect: Rect | null = null;

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

    const modalWidth = 520;
    const modalHeight = 330;
    const modalX = Math.floor((canvas.width - modalWidth) / 2);
    const modalY = Math.floor((canvas.height - modalHeight) / 2);

    this.modalRect = { x: modalX, y: modalY, width: modalWidth, height: modalHeight };
    this.closeRect = { x: modalX + modalWidth - 82, y: modalY + 14, width: 64, height: 28 };

    renderer.drawRect({ ...this.modalRect, color: hexToRgba(COLORS.panel.bg) });
    drawRectOutline(renderer, this.modalRect, 2, hexToRgba(COLORS.overlay.panelBorder));

    renderer.drawText({
      text: "Sisu Generator",
      x: modalX + 24,
      y: modalY + 36,
      font: "bold 20px Arial",
      color: COLORS.overlay.titleText,
      align: "left",
      baseline: "middle"
    });

    drawButton(this.closeRect, "Close", { active: false });

    const { displayCurrent } = updateSisuVisualProjection(snapshot);
    const currentSisu = Math.max(SISU_MIN_MULTIPLIER, displayCurrent);
    const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));

    const multiplierText = formatSisuMultiplier(currentSisu);
    renderer.drawText({
      text: multiplierText,
      x: modalX + modalWidth / 2,
      y: modalY + 100,
      font: SISU_CURRENT_FONT,
      color: COLORS.sisu.blue,
      align: "center",
      baseline: "middle",
      strokeColor: "black",
      strokeWidth: 4
    });

    this.refillRects.length = 0;
    const refillWidth = 132;
    const refillHeight = 88;
    const refillGap = 22;
    const totalRefillWidth = refillWidth * SISU_REFILL_TIERS.length + refillGap * (SISU_REFILL_TIERS.length - 1);
    const refillStartX = modalX + Math.floor((modalWidth - totalRefillWidth) / 2);
    const refillY = modalY + 144;

    for (let index = 0; index < SISU_REFILL_TIERS.length; index += 1) {
      const tier = SISU_REFILL_TIERS[index];
      const target = getSisuTierTarget(maxBasic, tier.id);
      const rect = {
        x: refillStartX + index * (refillWidth + refillGap),
        y: refillY,
        width: refillWidth,
        height: refillHeight
      };
      this.refillRects.push({ tier: tier.id, rect });
      drawSisuRefillControlNative(renderer, rect, tier.label, tier.colorKey, target, currentSisu);
    }

    const maxUpgradeLevel = snapshot.state.sisu.max_upgrade_level || 0;
    const maxSisuText = `Max Sisu: ${formatSisuMultiplier(maxBasic)} (Level ${formatCountRatio(maxUpgradeLevel, SISU_MAX_UPGRADE_LEVEL)})`;
    renderer.drawText({
      text: maxSisuText,
      x: modalX + 38,
      y: modalY + 272,
      font: SISU_MAX_FONT,
      color: COLORS.hud.textPrimary,
      align: "left",
      baseline: "middle",
      strokeColor: "black",
      strokeWidth: 3
    });

    this.upgradeRect = {
      x: modalX + modalWidth - 220,
      y: modalY + 248,
      width: 180,
      height: 36
    };

    const upgradeState = getUpgradeButtonState(snapshot.state.shards, maxUpgradeLevel);
    drawButton(this.upgradeRect, upgradeState.label, {
      active: false,
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
      this.closeRect,
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

function drawSisuRefillControlNative(
  renderer: WebGLRenderer,
  rect: Rect,
  label: string,
  colorKey: "blue" | "yellow" | "purple",
  target: number,
  currentSisu: number
) {
  const canRefill = currentSisu < target;
  const tierColor = COLORS.sisu[colorKey];

  const surfaceColor = canRefill ? COLORS.button.surface.active : COLORS.button.secondary.surface;
  renderer.drawRect({ ...rect, color: hexToRgba(surfaceColor) });

  const borderColor = canRefill ? tierColor : COLORS.button.secondary.border;
  drawRectOutline(renderer, rect, 2, hexToRgba(borderColor));

  const circleX = rect.x + rect.width / 2;
  const circleY = rect.y + 28;
  renderer.drawCircle(circleX, circleY, 14, hexToRgba(tierColor), 0.05);
  renderer.drawRing(circleX, circleY, 14, 1.5, hexToRgba(COLORS.button.text));

  renderer.drawText({
    text: label,
    x: circleX,
    y: rect.y + 57,
    font: SISU_METER_FONT,
    color: COLORS.button.text,
    align: "center",
    baseline: "middle"
  });

  const targetText = formatSisuMultiplier(target);
  renderer.drawText({
    text: targetText,
    x: circleX,
    y: rect.y + 76,
    font: TINY_TEXT_FONT,
    color: COLORS.button.text,
    align: "center",
    baseline: "middle",
    strokeColor: "black",
    strokeWidth: 2
  });
}
