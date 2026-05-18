import { COLORS } from "../../colors";
import {
  SISU_METER_FONT,
  SISU_METER_RADIUS,
  SISU_METER_THICKNESS
} from "../../config";
import type { ServerState } from "../../net/snapshots";
import { notices } from "../../ui/managers/notices";
import { InteractionState, pointInRect } from "../../ui/managers/interactions";
import { drawLockedElement } from "../../ui/components/locked-element";
import { clampNumber } from "../../utils";
import { formatUnlockRequirement, getShopItemRequiredLevel } from "../requirements";
import { getProgressBarLayout } from "../progress-bar/render";
import { updateGpuSisuTarget } from "../../render/webgl-effects";
import { getActiveWebGLRenderer, WebGLRenderer } from "../../renderer/webgl";
import { hexToRgba } from "../../utils/color";
import { queueTooltip } from "../../ui/components/tooltip";
import { renderSisuCrystal, type SisuCrystalTier } from "./crystal";
import {
  getSisuControlRect,
  getSisuTierTarget,
  getSisuVisualTier,
  SISU_BASE_MAX,
  SISU_MIN_MULTIPLIER,
  toFiniteBigNumNumber,
  updateSisuVisualProjection,
  type Rect
} from "./view-model";
export { createSisuGeneratorModal } from "./modal";

export type SisuControlLayout = {
  controlRect: Rect;
};

export { getSisuControlRect };

const SISU_MULTIPLIER_TEXT_KEY = "sisu.control.multiplier";
const SISU_GLASS_BALL_RADIUS = 32;

export function renderSisuControl(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState,
  blocked: boolean = false
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
    updateGpuSisuTarget(centerX, centerY);
    drawSisuControlNative(renderer, input, controlRect, snapshot, centerX, centerY, barRadius, displayCurrent, blocked);
  };

  if (!isUnlocked) {
    drawLockedElement(canvas, blocked ? { ...input, pointer: null, clicked: false } : input, controlRect, drawNative, {
      font: SISU_METER_FONT,
      criteria: formatUnlockRequirement(sisuRequiredLevel, snapshot.state.level),
      showNotice: notices.hasLeafNotice("leaf.feature.sisu_generator.locked_text"),
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
  displayCurrent: number,
  blocked: boolean = false
) {
  const maxBasic = Math.max(SISU_BASE_MAX, toFiniteBigNumNumber(snapshot.state.sisu.max_basic, SISU_BASE_MAX));
  const azureMax = getSisuTierTarget(maxBasic, "azure");
  const aetherMax = getSisuTierTarget(maxBasic, "aether");
  const lucentMax = getSisuTierTarget(maxBasic, "lucent");
  const transcendentMax = getSisuTierTarget(maxBasic, "transcendent");
  const startAngle = -Math.PI / 2;
  const fullCircle = Math.PI * 2;

  const getTierFillRatio = (value: number, tierMin: number, tierMax: number) => {
    if (tierMax <= tierMin) return value >= tierMax ? 1 : 0;
    return clampNumber((value - tierMin) / (tierMax - tierMin), 0, 1);
  };

  const showSisuHoverInfo = Boolean(snapshot.state.features.sisu_generator_purchased);
  const activeTier = getSisuVisualTier(snapshot);
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

  // Azure Tier
  const azureFillRatio = getTierFillRatio(displayCurrent, SISU_MIN_MULTIPLIER, azureMax);
  if (azureFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * azureFillRatio, hexToRgba(COLORS.sisu.azure));
  }

  // Aether Tier
  const aetherFillRatio = getTierFillRatio(displayCurrent, azureMax, aetherMax);
  if (aetherFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * aetherFillRatio, hexToRgba(COLORS.sisu.aether));
  }

  // Lucent Tier
  const lucentFillRatio = getTierFillRatio(displayCurrent, aetherMax, lucentMax);
  if (lucentFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * lucentFillRatio, hexToRgba(COLORS.sisu.lucent));
  }

  // Transcendent Tier
  const transcendentFillRatio = getTierFillRatio(displayCurrent, lucentMax, transcendentMax);
  if (transcendentFillRatio > 0) {
    renderer.drawArc(centerX, centerY, barRadius, SISU_METER_THICKNESS, startAngle, startAngle + fullCircle * transcendentFillRatio, hexToRgba(COLORS.sisu.transcendent));
  }

  // Multiplier Tooltip
  if (!blocked && showSisuHoverInfo && input.pointer && pointInRect(input.pointer, controlRect)) {
    const tooltipText = `Sisu Multiplier: x${displayCurrent.toFixed(displayCurrent >= 10 ? 1 : 2)}`;
    queueTooltip(input.pointer, tooltipText, {
      widthMode: 'estimated',
      estimatedWidthFactor: displayCurrent >= 10 ? 0.46 : 0.45,
      textUpdateKey: SISU_MULTIPLIER_TEXT_KEY
    });
  }
}
