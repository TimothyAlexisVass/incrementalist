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
import { notices } from "../../ui/managers/notices";
import { InteractionState } from "../../ui/managers/interactions";
import type { Modal } from "../../ui/managers/modals";
import { drawLockedElement } from "../../ui/components/locked-element";
import { clampNumber } from "../../utils";
import { formatCountRatio, formatNumber, formatSisuMultiplier } from "../../utils/format";
import { getProgressBarLayout } from "../progress-bar/render";
import { getActiveWebGLRenderer } from "../../renderer/webgl";

import { handleSisuModalInteractions, type SisuRefillHitRect } from "./interactions";
import {
  formatDecay,
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
};

export { getSisuControlRect };
let sisuSurface: HTMLCanvasElement | null = null;
let sisuSurfaceCtx: CanvasRenderingContext2D | null = null;

export function renderSisuControl(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState
): SisuControlLayout | null {
  const renderer = getActiveWebGLRenderer();
  const target = renderer ? getSisuSurfaceContext(canvas) : null;
  if (!target) return null;
  const layout = renderSisuControlToContext(target, canvas, input, state);
  if (renderer && sisuSurface) {
    renderer.drawImage({
      image: sisuSurface,
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height
    });
  }
  return layout;
}

function renderSisuControlToContext(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState
): SisuControlLayout | null {
  const snapshot = state.snapshot;
  if (!snapshot) return null;

  const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));
  const { displayCurrent, displayCycleDecay } = updateSisuVisualProjection(snapshot);
  const blueMax = getSisuTierTarget(maxBasic, "blue");
  const yellowMax = getSisuTierTarget(maxBasic, "yellow");
  const purpleMax = getSisuTierTarget(maxBasic, "purple");
  const isUnlocked = Boolean(snapshot.state.features.sisu_generator_purchased);

  const barRadius = 35;
  const progressBar = getProgressBarLayout(canvas);
  const centerX = progressBar.x + progressBar.width / 2;
  const centerY = progressBar.y + progressBar.height + 120;
  const controlRect = getSisuControlRect(canvas);
  const startAngle = -Math.PI / 2;
  const fullCircle = Math.PI * 2;

  const getTierFillRatio = (value: number, tierMin: number, tierMax: number) => {
    if (tierMax <= tierMin) {
      return value >= tierMax ? 1 : 0;
    }

    return clampNumber((value - tierMin) / (tierMax - tierMin), 0, 1);
  };

  const drawSisuControl = () => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, barRadius, 0, Math.PI * 2, false);
    ctx.strokeStyle = COLORS.bar.border;
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, barRadius, 0, Math.PI * 2, false);
    ctx.strokeStyle = COLORS.bar.track;
    ctx.lineWidth = 12;
    ctx.stroke();

    const blueFillRatio = getTierFillRatio(displayCurrent, SISU_MIN_MULTIPLIER, blueMax);
    if (blueFillRatio > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, barRadius, startAngle, startAngle + fullCircle * blueFillRatio, false);
      ctx.strokeStyle = COLORS.sisu.blue;
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    const yellowFillRatio = getTierFillRatio(displayCurrent, blueMax, yellowMax);
    if (yellowFillRatio > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, barRadius, startAngle, startAngle + fullCircle * yellowFillRatio, false);
      ctx.strokeStyle = COLORS.sisu.yellow;
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    const purpleFillRatio = getTierFillRatio(displayCurrent, yellowMax, purpleMax);
    if (purpleFillRatio > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, barRadius, startAngle, startAngle + fullCircle * purpleFillRatio, false);
      ctx.strokeStyle = COLORS.sisu.purple;
      ctx.lineWidth = 10;
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.hud.textPrimary;
    ctx.font = SISU_MAX_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatSisuMultiplier(displayCurrent), centerX, centerY - 3);

    ctx.fillStyle = COLORS.sisu.decay;
    ctx.font = SISU_DECAY_FONT;
    ctx.fillText(`-${formatDecay(displayCycleDecay)}%`, centerX, centerY + 12);
  };

  if (!isUnlocked) {
    drawLockedElement(canvas, input, controlRect, drawSisuControl, {
      font: SISU_METER_FONT,
      showNotice: notices.hasLeafNotice("leaf.feature.sisu_generator.locked_text"),
      showNoticePing: true
    });
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

  render(canvas: HTMLCanvasElement, input: InteractionState) {
    const renderer = getActiveWebGLRenderer();
    const drawCtx = renderer ? getSisuSurfaceContext(canvas) : null;
    if (!drawCtx) return;
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

    drawCtx.save();
    drawCtx.fillStyle = COLORS.panel.bg;
    drawCtx.fillRect(this.modalRect.x, this.modalRect.y, this.modalRect.width, this.modalRect.height);
    drawCtx.strokeStyle = COLORS.overlay.panelBorder;
    drawCtx.lineWidth = 2;
    drawCtx.strokeRect(this.modalRect.x, this.modalRect.y, this.modalRect.width, this.modalRect.height);

    drawCtx.fillStyle = COLORS.overlay.titleText;
    drawCtx.font = "bold 20px Arial";
    drawCtx.textAlign = "left";
    drawCtx.textBaseline = "middle";
    drawCtx.fillText("Sisu Generator", modalX + 24, modalY + 36);

    drawButton(this.closeRect, "Close", { active: false });

    const { displayCurrent, displayCycleDecay } = updateSisuVisualProjection(snapshot);
    const currentSisu = Math.max(SISU_MIN_MULTIPLIER, displayCurrent);
    const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));

    drawCtx.fillStyle = COLORS.sisu.blue;
    drawCtx.font = SISU_CURRENT_FONT;
    drawCtx.textAlign = "center";
    drawCtx.fillText(formatSisuMultiplier(currentSisu), modalX + modalWidth / 2, modalY + 88);

    drawCtx.fillStyle = COLORS.sisu.decay;
    drawCtx.font = SISU_MAX_FONT;
    drawCtx.fillText(`-${formatDecay(displayCycleDecay)}%`, modalX + modalWidth / 2, modalY + 116);

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
      drawSisuRefillControl(drawCtx, rect, tier.label, tier.colorKey, target, currentSisu);
    }

    const maxUpgradeLevel = snapshot.state.sisu.max_upgrade_level || 0;
    drawCtx.fillStyle = COLORS.hud.textPrimary;
    drawCtx.font = SISU_MAX_FONT;
    drawCtx.textAlign = "left";
    drawCtx.fillText(
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

    drawCtx.restore();
    if (renderer && sisuSurface) {
      renderer.drawImage({
        image: sisuSurface,
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height
      });
    }
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

function getSisuSurfaceContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (!sisuSurface) {
    sisuSurface = document.createElement("canvas");
  }
  if (sisuSurface.width !== canvas.width) sisuSurface.width = canvas.width;
  if (sisuSurface.height !== canvas.height) sisuSurface.height = canvas.height;
  if (!sisuSurfaceCtx) {
    sisuSurfaceCtx = sisuSurface.getContext("2d");
  }
  if (!sisuSurfaceCtx) return null;
  sisuSurfaceCtx.clearRect(0, 0, sisuSurface.width, sisuSurface.height);
  return sisuSurfaceCtx;
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
    ? (renderer
      ? renderer.measureTextWidth({ text: leftText, font: SISU_UPGRADE_BUTTON_FONT })
      : 0)
    : 0;
  const amountWidth = measureCurrencyAmount(cost, iconSize, {
    font: SISU_UPGRADE_BUTTON_FONT,
    iconGap
  });
  const rightWidth = rightText
    ? (renderer
      ? renderer.measureTextWidth({ text: rightText, font: SISU_UPGRADE_BUTTON_FONT })
      : 0)
    : 0;
  const totalWidth = leftWidth + amountWidth + rightWidth;
  let currentX = rect.x + rect.width / 2 - totalWidth / 2;

  if (leftText) {
    if (renderer) {
      renderer.drawText({
        text: leftText,
        x: currentX,
        y: textY,
        font: SISU_UPGRADE_BUTTON_FONT,
        color: textColor,
        align: "left",
        baseline: "alphabetic"
      });
    }
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
    if (renderer) {
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
