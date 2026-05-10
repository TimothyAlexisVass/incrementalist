import { COLORS } from "../../colors";
import {
  SISU_CURRENT_FONT,
  SISU_DECAY_FONT,
  SISU_MAX_FONT,
  SISU_METER_FONT,
  SISU_UPGRADE_BUTTON_FONT
} from "../../config";
import type { BigNum } from "../../core/bignum";
import type { GameChannel } from "../../net/game-channel";
import type { ServerResult } from "../../net/protocol";
import type { ServerState } from "../../net/snapshots";
import { drawCurrencyAmount, measureCurrencyAmount } from "../../render/currency-icons";
import { drawButton } from "../../ui/components/button";
import type { InteractionState } from "../../ui/managers/interactions";
import type { Modal } from "../../ui/managers/modals";
import { clampNumber, drawLockedElement, rgbArrayToCss } from "../../utils";
import { formatCountRatio, formatNumber, formatSisuMultiplier } from "../../utils/format";
import { getProgressBarLayout } from "../progress-bar/render";

import { handleSisuModalInteractions, type SisuRefillHitRect } from "./interactions";
import {
  formatDecay,
  getSisuControlRect,
  getSisuMeterColorArray,
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

export function renderSisuControl(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: ServerState
): SisuControlLayout | null {
  const snapshot = state.snapshot;
  if (!snapshot) return null;

  const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));
  const { displayCurrent, displayCycleDecay } = updateSisuVisualProjection(snapshot);
  const purpleMax = getSisuTierTarget(maxBasic, "purple");
  const isUnlocked = Boolean(snapshot.state.features.sisu_generator_purchased);

  const barRadius = 35;
  const progressBar = getProgressBarLayout(canvas);
  const centerX = progressBar.x + progressBar.width / 2;
  const centerY = progressBar.y + progressBar.height + 100;
  const controlRect = getSisuControlRect(canvas);

  const drawSisuControl = () => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, barRadius, Math.PI, 0, false);
    ctx.strokeStyle = COLORS.bar.border;
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, barRadius, Math.PI, 0, false);
    ctx.strokeStyle = COLORS.bar.track;
    ctx.lineWidth = 12;
    ctx.stroke();

    const fillRatio = clampNumber(displayCurrent / purpleMax, 0, 1);
    if (fillRatio > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, barRadius, Math.PI, Math.PI + Math.PI * fillRatio, false);
      ctx.strokeStyle = rgbArrayToCss(getSisuMeterColorArray(displayCurrent, maxBasic));
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.hud.textPrimary;
    ctx.font = SISU_MAX_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatSisuMultiplier(displayCurrent), centerX, centerY + 5);

    ctx.fillStyle = COLORS.sisu.decay;
    ctx.font = SISU_DECAY_FONT;
    ctx.fillText(`-${formatDecay(displayCycleDecay)}%`, centerX, centerY + 20);

    const iconY = centerY + 35;
    drawSisuHudIcon(ctx, centerX - 18, iconY, "blue");
    drawSisuHudIcon(ctx, centerX, iconY, "yellow");
    drawSisuHudIcon(ctx, centerX + 18, iconY, "purple");
  };

  if (!isUnlocked) {
    drawLockedElement(ctx, controlRect, drawSisuControl, { font: SISU_METER_FONT });
  } else {
    drawSisuControl();
  }

  return { controlRect };
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
  ) {}

  render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState) {
    const snapshot = this.getState().snapshot;
    if (!snapshot || !snapshot.state.features.sisu_generator_purchased) {
      this.onClose();
      return;
    }

    const modalWidth = 520;
    const modalHeight = 330;
    const modalX = Math.floor((canvas.width - modalWidth) / 2);
    const modalY = Math.floor((canvas.height - modalHeight) / 2);

    this.modalRect = {
      x: modalX,
      y: modalY,
      width: modalWidth,
      height: modalHeight
    };

    this.closeRect = {
      x: modalX + modalWidth - 82,
      y: modalY + 14,
      width: 64,
      height: 28
    };

    ctx.save();
    ctx.fillStyle = COLORS.panel.bg;
    ctx.fillRect(this.modalRect.x, this.modalRect.y, this.modalRect.width, this.modalRect.height);
    ctx.strokeStyle = COLORS.overlay.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.modalRect.x, this.modalRect.y, this.modalRect.width, this.modalRect.height);

    ctx.fillStyle = COLORS.overlay.titleText;
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Sisu Generator", modalX + 24, modalY + 36);

    drawButton(ctx, this.closeRect, "Close", { active: false });

    const { displayCurrent, displayCycleDecay } = updateSisuVisualProjection(snapshot);
    const currentSisu = Math.max(SISU_MIN_MULTIPLIER, displayCurrent);
    const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));

    ctx.fillStyle = COLORS.sisu.blue;
    ctx.font = SISU_CURRENT_FONT;
    ctx.textAlign = "center";
    ctx.fillText(formatSisuMultiplier(currentSisu), modalX + modalWidth / 2, modalY + 88);

    ctx.fillStyle = COLORS.sisu.decay;
    ctx.font = SISU_MAX_FONT;
    ctx.fillText(`-${formatDecay(displayCycleDecay)}%`, modalX + modalWidth / 2, modalY + 116);

    this.refillRects.length = 0;
    const refillWidth = 132;
    const refillHeight = 88;
    const refillGap = 22;
    const totalRefillWidth =
      refillWidth * SISU_REFILL_TIERS.length + refillGap * (SISU_REFILL_TIERS.length - 1);
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
      drawSisuRefillControl(ctx, rect, tier.label, tier.colorKey, target, currentSisu);
    }

    const maxUpgradeLevel = snapshot.state.sisu.max_upgrade_level || 0;
    ctx.fillStyle = COLORS.hud.textPrimary;
    ctx.font = SISU_MAX_FONT;
    ctx.textAlign = "left";
    ctx.fillText(
      `Max Sisu: ${formatSisuMultiplier(maxBasic)} (Level ${formatCountRatio(maxUpgradeLevel, SISU_MAX_UPGRADE_LEVEL)})`,
      modalX + 38,
      modalY + 272
    );

    this.upgradeRect = {
      x: modalX + modalWidth - 220,
      y: modalY + 248,
      width: 180,
      height: 36
    };

    const upgradeState = getUpgradeButtonState(snapshot.state.shards, maxUpgradeLevel);
    drawButton(ctx, this.upgradeRect, upgradeState.label, {
      active: false,
      activeSurface: upgradeState.disabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
      inactiveSurface: upgradeState.disabled ? COLORS.button.secondary.surface : COLORS.button.surface.active,
      activeBorder: upgradeState.disabled ? COLORS.button.secondary.border : COLORS.button.border.active,
      inactiveBorder: upgradeState.disabled ? COLORS.button.secondary.border : COLORS.button.border.active,
      textColor: COLORS.button.text,
      font: SISU_UPGRADE_BUTTON_FONT,
      textY: this.upgradeRect.y + 23
    });

    if (upgradeState.cost !== null) {
      drawUpgradeCostLabel(ctx, this.upgradeRect, upgradeState.prefix, upgradeState.cost);
    }

    ctx.restore();

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

function drawUpgradeCostLabel(ctx: CanvasRenderingContext2D, rect: Rect, prefix: string | null, cost: BigNum) {
  const textY = rect.y + 23;
  const iconSize = 18;
  const iconGap = 4;
  const currencyKey = "shards";
  const textColor = COLORS.button.text;
  const leftText = prefix ? `${prefix} (` : "";
  const rightText = prefix ? ")" : "";

  ctx.save();
  ctx.font = SISU_UPGRADE_BUTTON_FONT;

  const leftWidth = leftText ? ctx.measureText(leftText).width : 0;
  const amountWidth = measureCurrencyAmount(ctx, cost, iconSize, {
    font: SISU_UPGRADE_BUTTON_FONT,
    iconGap
  });
  const rightWidth = rightText ? ctx.measureText(rightText).width : 0;
  const totalWidth = leftWidth + amountWidth + rightWidth;
  let currentX = rect.x + rect.width / 2 - totalWidth / 2;

  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  if (leftText) {
    ctx.fillText(leftText, currentX, textY);
    currentX += leftWidth;
  }

  drawCurrencyAmount(ctx, currencyKey, cost, currentX, textY, iconSize, {
    align: "left",
    font: SISU_UPGRADE_BUTTON_FONT,
    textColor,
    iconGap,
    formatter: formatNumber
  });
  currentX += amountWidth;

  if (rightText) {
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.fillText(rightText, currentX, textY);
  }

  ctx.restore();
}

function drawSisuHudIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  colorKey: "blue" | "yellow" | "purple"
) {
  ctx.beginPath();
  ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.sisu[colorKey];
  ctx.fill();
  ctx.strokeStyle = COLORS.hud.textPrimary;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSisuRefillControl(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  colorKey: "blue" | "yellow" | "purple",
  target: number,
  currentSisu: number
) {
  const canRefill = currentSisu < target;
  const tierColor = COLORS.sisu[colorKey];

  ctx.fillStyle = canRefill ? COLORS.button.surface.active : COLORS.button.secondary.surface;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = canRefill ? tierColor : COLORS.button.secondary.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  const circleX = rect.x + rect.width / 2;
  const circleY = rect.y + 28;
  ctx.beginPath();
  ctx.arc(circleX, circleY, 14, 0, Math.PI * 2);
  ctx.fillStyle = tierColor;
  ctx.fill();
  ctx.strokeStyle = COLORS.button.text;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = COLORS.button.text;
  ctx.font = SISU_METER_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, circleX, rect.y + 57);
  ctx.font = SISU_DECAY_FONT;
  ctx.fillText(formatSisuMultiplier(target), circleX, rect.y + 76);
}
