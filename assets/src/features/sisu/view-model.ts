import { compare, fromNumber, mul, toNumber, type BigNum } from "../../core/bignum";
import type { ServerState } from "../../net/snapshots";
import { clampNumber, lerp } from "../../utils";
import { formatMultiplierDelta } from "../../utils/format";
import { getProgressBarLayout } from "../progress-bar/render";
import { getViewModel as getProgressBarViewModel } from "../progress-bar/view-model";
import { getServerNow } from "../../core/time";
import { SISU_METER_RADIUS } from "../../config";

import { UPGRADE_COSTS } from "./levels";

export type Rect = { x: number; y: number; width: number; height: number };

export type TierId = "blue" | "yellow" | "purple";

export type SisuRefillTier = {
  id: TierId;
  label: string;
  colorKey: "blue" | "yellow" | "purple";
  multiplier: number;
};

export const SISU_BASE_MAX = 2;
export const SISU_MIN_MULTIPLIER = 1;
export const SISU_MAX_UPGRADE_LEVEL = UPGRADE_COSTS.length - 1;

const SISU_REFILL_TIERS_BY_ID: Record<TierId, SisuRefillTier> = {
  blue: { id: "blue", label: "Blue", colorKey: "blue", multiplier: 1.0 },
  yellow: { id: "yellow", label: "Yellow", colorKey: "yellow", multiplier: 1.5 },
  purple: { id: "purple", label: "Purple", colorKey: "purple", multiplier: 2.5 }
};

export const SISU_REFILL_TIERS: readonly SisuRefillTier[] = Object.values(SISU_REFILL_TIERS_BY_ID);

const SISU_VISUAL_STATE = {
  displayCurrent: SISU_MIN_MULTIPLIER,
  initialized: false,
  lastTimestampMs: 0
};

export function getSisuControlRect(canvas: HTMLCanvasElement): Rect {
  const progressBar = getProgressBarLayout(canvas);
  const barRadius = SISU_METER_RADIUS;
  const centerX = progressBar.x + progressBar.width / 2;
  const centerY = progressBar.y + progressBar.height + 120;

  return {
    x: centerX - barRadius,
    y: centerY - barRadius,
    width: barRadius * 2,
    height: barRadius + 34
  };
}

export function getSisuTierTarget(maxBasic: number, tierId: TierId): number {
  const tier = SISU_REFILL_TIERS_BY_ID[tierId];
  return Math.round(maxBasic * tier.multiplier * 100) / 100;
}


export function toFiniteBigNumNumber(value: BigNum | undefined | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function updateSisuVisualProjection(snapshot: NonNullable<ServerState["snapshot"]>) {
  const nowMs = getNowMs();
  const lastMs = SISU_VISUAL_STATE.lastTimestampMs || nowMs;
  SISU_VISUAL_STATE.lastTimestampMs = nowMs;
  const dtSeconds = Math.max(0, nowMs - lastMs) / 1000;

  const progressBarVm = getProgressBarViewModel();
  const progressRatio = clampNumber((progressBarVm.projectedFill || 0) / 100, 0, 1);

  const baseCurrent = Math.max(
    SISU_MIN_MULTIPLIER,
    toFiniteBigNumNumber(snapshot.state.sisu.current, SISU_MIN_MULTIPLIER)
  );
  const baseCycleDecay = Math.max(0, Number(snapshot.state.sisu.cycle_decay) || 0);
  const boundedCycleDecay = clampNumber(baseCycleDecay, 0, 100);
  const nextFactor = fromNumber(1.0 - boundedCycleDecay / 100);
  const nextSisu = mul(snapshot.state.sisu.current, nextFactor);
  const targetAtClaim = Math.max(SISU_MIN_MULTIPLIER, toFiniteBigNumNumber(nextSisu, baseCurrent));

  const projectedCurrent = lerp(baseCurrent, targetAtClaim, progressRatio);

  if (!SISU_VISUAL_STATE.initialized) {
    SISU_VISUAL_STATE.displayCurrent = projectedCurrent;
    SISU_VISUAL_STATE.initialized = true;
  }

  const meterSpeed = projectedCurrent >= SISU_VISUAL_STATE.displayCurrent ? 10 : 2;
  const meterT = clampNumber(1 - Math.exp(-meterSpeed * dtSeconds), 0, 1);

  SISU_VISUAL_STATE.displayCurrent = Math.max(
    SISU_MIN_MULTIPLIER,
    lerp(SISU_VISUAL_STATE.displayCurrent, projectedCurrent, meterT)
  );

  return {
    displayCurrent: SISU_VISUAL_STATE.displayCurrent
  };
}

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return getServerNow();
}

export function getUpgradeButtonState(
  shards: BigNum,
  currentLevel: number
): {
  disabled: boolean;
  label: string;
  prefix: string | null;
  cost: BigNum | null;
} {
  const cost = UPGRADE_COSTS[currentLevel + 1];

  if (currentLevel >= SISU_MAX_UPGRADE_LEVEL || !cost) {
    return {
      disabled: true,
      label: "MAX",
      prefix: null,
      cost: null
    };
  }

  if (compare(shards, cost) < 0) {
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
