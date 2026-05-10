import { COLORS } from "../../colors";
import {
  SISU_CURRENT_FONT,
  SISU_DECAY_FONT,
  SISU_MAX_FONT,
  SISU_METER_FONT,
  SISU_UPGRADE_BUTTON_FONT
} from "../../config";
import { fromNumber, mul, toNumber, type BigNum } from "../../core/bignum";
import { drawCurrencyAmount, measureCurrencyAmount } from "../../render/currency-icons";
import { sisuRefill, sisuUpgradeMax } from "../../net/commands";
import type { ServerResult } from "../../net/protocol";
import type { ServerState } from "../../net/snapshots";
import { drawButton } from "../../ui/components/button";
import type { InteractionState } from "../../ui/managers/interactions";
import { pointInRect } from "../../ui/managers/interactions";
import type { Modal } from "../../ui/managers/modals";
import { clampNumber, drawLockedElement, hexToRgbArray, lerp, lerpColor, rgbArrayToCss } from "../../utils";
import { formatCountRatio, formatMultiplierDelta, formatNumber, formatSisuMultiplier } from "../../utils/format";
import type { GameChannel } from "../../net/game-channel";
import { getProgressBarLayout } from "../progress-bar/render";
import { getViewModel } from "../progress-bar/view-model";

type Rect = { x: number; y: number; width: number; height: number };

type TierId = "blue" | "yellow" | "purple";

const SISU_BASE_MAX = 2;
const SISU_MIN_MULTIPLIER = 1;
const SISU_MAX_UPGRADE_LEVEL = 1770;
const SISU_REFILL_TIERS: Record<TierId, { id: TierId; label: string; colorKey: "blue" | "yellow" | "purple"; multiplier: number }> = {
  blue: { id: "blue", label: "Blue", colorKey: "blue", multiplier: 1.0 },
  yellow: { id: "yellow", label: "Yellow", colorKey: "yellow", multiplier: 1.5 },
  purple: { id: "purple", label: "Purple", colorKey: "purple", multiplier: 2.5 }
};

const SISU_VISUAL_STATE = {
  displayCurrent: SISU_MIN_MULTIPLIER,
  displayCycleDecay: 0,
  initialized: false,
  lastTimestampMs: 0
};

export type SisuControlLayout = {
  controlRect: Rect;
};

export function getSisuControlRect(canvas: HTMLCanvasElement): Rect {
  const progressBar = getProgressBarLayout(canvas);
  const barRadius = 35;
  const centerX = progressBar.x + progressBar.width / 2;
  const centerY = progressBar.y + progressBar.height + 100;

  return {
    x: centerX - barRadius,
    y: centerY - barRadius,
    width: barRadius * 2,
    height: barRadius + 42
  };
}

export function renderSisuControl(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: ServerState
): SisuControlLayout | null {
  const snapshot = state.snapshot;
  if (!snapshot) return null;

  const sisu = snapshot.state.sisu;
  const current = Math.max(SISU_MIN_MULTIPLIER, toFiniteBigNumNumber(sisu?.current, SISU_MIN_MULTIPLIER));
  const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(sisu?.max_basic, SISU_BASE_MAX));
  const { displayCurrent, displayCycleDecay } = updateSisuVisualProjection(snapshot);
  const purpleMax = maxBasic * SISU_REFILL_TIERS.purple.multiplier;
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
    drawSisuHudIcon(ctx, centerX - 18, iconY, SISU_REFILL_TIERS.blue.colorKey);
    drawSisuHudIcon(ctx, centerX, iconY, SISU_REFILL_TIERS.yellow.colorKey);
    drawSisuHudIcon(ctx, centerX + 18, iconY, SISU_REFILL_TIERS.purple.colorKey);
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
  private readonly refillRects: Array<{ tier: TierId; rect: Rect }> = [];
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
    const tierValues = Object.values(SISU_REFILL_TIERS);
    const refillWidth = 132;
    const refillHeight = 88;
    const refillGap = 22;
    const totalRefillWidth = (refillWidth * tierValues.length) + (refillGap * (tierValues.length - 1));
    const refillStartX = modalX + Math.floor((modalWidth - totalRefillWidth) / 2);
    const refillY = modalY + 144;

    for (let index = 0; index < tierValues.length; index += 1) {
      const tier = tierValues[index];
      const target = getSisuTierTarget(maxBasic, tier.id);
      const rect = {
        x: refillStartX + (index * (refillWidth + refillGap)),
        y: refillY,
        width: refillWidth,
        height: refillHeight
      };
      this.refillRects.push({ tier: tier.id, rect });
      drawSisuRefillControl(ctx, rect, tier, target, currentSisu);
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

    if (handleClick(input, this.closeRect)) {
      this.onClose();
      return;
    }

    if (this.modalRect && input.clicked && !input.consumed && input.pointer && !pointInRect(input.pointer, this.modalRect)) {
      input.consumed = true;
      this.onClose();
      return;
    }

    if (this.upgradeRect && !upgradeState.disabled && handleClick(input, this.upgradeRect)) {
      void this.runCommand(() => sisuUpgradeMax(this.channel));
      return;
    }

    for (const refillRect of this.refillRects) {
      if (handleClick(input, refillRect.rect)) {
        void this.runCommand(() => sisuRefill(this.channel, refillRect.tier));
        return;
      }
    }
  }

  tick(_dt: number, _input: InteractionState) {
    // Reactive-only modal.
  }
}

function handleClick(input: InteractionState, rect: Rect | null): boolean {
  if (!rect || !input.clicked || input.consumed || !input.pointer) {
    return false;
  }

  if (!pointInRect(input.pointer, rect)) {
    return false;
  }

  input.consumed = true;
  return true;
}

function drawUpgradeCostLabel(ctx: CanvasRenderingContext2D, rect: Rect, prefix: string | null, cost: number) {
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
  let currentX = rect.x + (rect.width / 2) - (totalWidth / 2);

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
  tier: { label: string; colorKey: "blue" | "yellow" | "purple" },
  target: number,
  currentSisu: number
) {
  const canRefill = currentSisu < target;
  const tierColor = COLORS.sisu[tier.colorKey];

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
  ctx.fillText(tier.label, circleX, rect.y + 57);
  ctx.font = SISU_DECAY_FONT;
  ctx.fillText(formatSisuMultiplier(target), circleX, rect.y + 76);
}

function getSisuTierTarget(maxBasic: number, tierId: TierId): number {
  const tier = SISU_REFILL_TIERS[tierId];
  return Math.round(maxBasic * tier.multiplier * 100) / 100;
}

function getSisuMeterColorArray(sisuValue: number, maxBasic: number): [number, number, number] {
  const blueMax = Math.max(1, maxBasic);
  const yellowMax = blueMax * SISU_REFILL_TIERS.yellow.multiplier;
  const purpleMax = blueMax * SISU_REFILL_TIERS.purple.multiplier;
  const sisu = clampNumber(sisuValue, 0, purpleMax);

  const darkBlue = hexToRgbArray(COLORS.sisu.darkBlue);
  const blue = hexToRgbArray(COLORS.sisu.blue);
  const yellow = hexToRgbArray(COLORS.sisu.yellow);
  const purple = hexToRgbArray(COLORS.sisu.purple);

  if (sisu <= blueMax) {
    return lerpColor(darkBlue, blue, blueMax > 0 ? sisu / blueMax : 0);
  }

  if (sisu <= yellowMax) {
    return lerpColor(blue, yellow, (sisu - blueMax) / Math.max(1, yellowMax - blueMax));
  }

  return lerpColor(yellow, purple, (sisu - yellowMax) / Math.max(1, purpleMax - yellowMax));
}

function toFiniteBigNumNumber(value: BigNum | undefined | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function updateSisuVisualProjection(snapshot: NonNullable<ServerState["snapshot"]>) {
  const nowMs = getNowMs();
  const lastMs = SISU_VISUAL_STATE.lastTimestampMs || nowMs;
  SISU_VISUAL_STATE.lastTimestampMs = nowMs;
  const dtSeconds = Math.max(0, nowMs - lastMs) / 1000;

  const vm = getViewModel();
  const progressRatio = clampNumber((vm.projectedFill || 0) / 100, 0, 1);

  const baseCurrent = Math.max(SISU_MIN_MULTIPLIER, toFiniteBigNumNumber(snapshot.state.sisu.current, SISU_MIN_MULTIPLIER));
  const baseCycleDecay = Math.max(0, Number(snapshot.state.sisu.cycle_decay) || 0);
  const boundedCycleDecay = clampNumber(baseCycleDecay, 0, 100);
  const nextFactor = fromNumber(1.0 - boundedCycleDecay / 100);
  const nextSisu = mul(snapshot.state.sisu.current, nextFactor);
  const targetAtClaim = Math.max(SISU_MIN_MULTIPLIER, toFiniteBigNumNumber(nextSisu, baseCurrent));
  const cycleDecayAtClaim = Math.max(0, baseCycleDecay * 0.98);

  const projectedCurrent = lerp(baseCurrent, targetAtClaim, progressRatio);
  const projectedCycleDecay = lerp(baseCycleDecay, cycleDecayAtClaim, progressRatio);

  if (!SISU_VISUAL_STATE.initialized) {
    SISU_VISUAL_STATE.displayCurrent = projectedCurrent;
    SISU_VISUAL_STATE.displayCycleDecay = projectedCycleDecay;
    SISU_VISUAL_STATE.initialized = true;
  }

  const meterSpeed = projectedCurrent >= SISU_VISUAL_STATE.displayCurrent ? 10 : 2;
  const meterT = clampNumber(1 - Math.exp(-meterSpeed * dtSeconds), 0, 1);
  const decayT = clampNumber(1 - Math.exp(-8 * dtSeconds), 0, 1);

  SISU_VISUAL_STATE.displayCurrent = Math.max(
    SISU_MIN_MULTIPLIER,
    lerp(SISU_VISUAL_STATE.displayCurrent, projectedCurrent, meterT)
  );
  SISU_VISUAL_STATE.displayCycleDecay = Math.max(
    0,
    lerp(SISU_VISUAL_STATE.displayCycleDecay, projectedCycleDecay, decayT)
  );

  return {
    displayCurrent: SISU_VISUAL_STATE.displayCurrent,
    displayCycleDecay: SISU_VISUAL_STATE.displayCycleDecay
  };
}

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function formatDecay(value: number | null | undefined): string {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  return (Math.round(safe * 100) / 100).toFixed(2);
}

function getUpgradeButtonState(shards: BigNum, currentLevel: number): {
  disabled: boolean;
  label: string;
  prefix: string | null;
  cost: number | null;
} {
  const cost = getMaxSisuUpgradeCost(currentLevel + 1);

  if (currentLevel >= SISU_MAX_UPGRADE_LEVEL) {
    return {
      disabled: true,
      label: "MAX",
      prefix: null,
      cost: null
    };
  }

  if (!Number.isFinite(cost) || cost <= 0) {
    return {
      disabled: true,
      label: "Upgrade",
      prefix: null,
      cost: null
    };
  }

  if (toNumber(shards) < cost) {
    return {
      disabled: true,
      label: "",
      prefix: null,
      cost
    };
  }

  return {
    disabled: false,
    label: "",
    prefix: formatMultiplierDelta(0.5),
    cost
  };
}

function getMaxSisuUpgradeCost(level: number): number {
  if (level <= 0) {
    return 0;
  }

  if (level > SISU_MAX_UPGRADE_LEVEL) {
    return NaN;
  }

  if (level <= 12) {
    const exponentShift = Math.floor((level - 1) / 3);
    const earlyMultipliers = [1, 2, 4];
    return 2.5e3 * earlyMultipliers[(level - 1) % 3] * (10 ** exponentShift);
  }

  const offset = level - 13;
  const exponent = 7 + Math.floor(offset / 6);
  const lateMantissas = [1.5, 2.25, 3.25, 4.5, 6.5, 9.5];
  return lateMantissas[offset % 6] * (10 ** exponent);
}
