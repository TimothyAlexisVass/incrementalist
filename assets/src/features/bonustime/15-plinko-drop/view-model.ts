import { BigNum } from "../../../core/bignum";
import { ServerState } from "../../../net/snapshots";
import { FittedRect, Rect, fitRectWithinBonusTimeArea } from "../layout";

const DEFAULT_ROWS = 13;
const DEFAULT_LANES = 7;
const MIN_LANES = 1;
const MIN_TIER = 1;
const MAX_TIER = 7;
const MIN_TRUE_FOR_TIER = 6;

const PLINKO_BASE_WIDTH_PX = 560;
const PLINKO_BASE_HEIGHT_PX = 460;

const BOARD_HORIZONTAL_PADDING_PX = 0;
const BOARD_TOP_PADDING_PX = 0;
const BOARD_BOTTOM_PADDING_PX = 84;
const BINS_HEIGHT_PX = 68;

const DROP_STEP_MS = 550;
const DROP_SETTLE_MS = 250;
const DROP_GAP_MS = 220;

export interface PlinkoDropReplay {
  tier: number;
  landingLane: number;
  trueCount: number;
  rolls: boolean[];
}

export interface PlinkoDropData {
  hasToken: boolean;
  rows: number;
  lanes: number;
  drops: PlinkoDropReplay[];
  bestDropIndex: number | null;
  lastTier: number | null;
  lastRewardAmount: BigNum | null;
  lastPlayedAt: string | null;
}

export interface PlinkoLayout {
  frame: FittedRect;
  boardRect: Rect;
  binsRect: Rect;
  buttonRect: Rect;
}

export function getPlinkoDropData(state: ServerState): PlinkoDropData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const hasToken = snapshot.state.has_bonustime_token || db.special_tokens > 0;
  const lastResult = db.last_result;
  const isPlinkoResult = lastResult?.game_id === "plinko_drop";
  const plinko = isPlinkoResult ? lastResult?.plinko : null;

  const rows = Math.max(DEFAULT_ROWS, positiveInteger(plinko?.rows, DEFAULT_ROWS));
  const lanes = Math.max(MIN_LANES, positiveInteger(plinko?.lanes, DEFAULT_LANES));
  const drops = normalizeDrops(plinko?.drops, rows, lanes);
  const bestDropIndex =
    drops.length > 0 ? clampIndex(toInteger(plinko?.best_drop_index, 0), drops.length) : null;

  return {
    hasToken,
    rows,
    lanes,
    drops,
    bestDropIndex,
    lastTier: isPlinkoResult ? toNullableTier(lastResult?.tier) : null,
    lastRewardAmount: isPlinkoResult ? (lastResult?.reward_amount ?? null) : null,
    lastPlayedAt: isPlinkoResult && typeof lastResult?.played_at === "string" ? lastResult.played_at : null
  };
}

export function getPlinkoLayout(container: Rect): PlinkoLayout {
  const frame = fitRectWithinBonusTimeArea(container, PLINKO_BASE_WIDTH_PX, PLINKO_BASE_HEIGHT_PX);
  const scale = frame.scale;

  const boardRect: Rect = {
    x: frame.x + BOARD_HORIZONTAL_PADDING_PX * scale,
    y: frame.y + BOARD_TOP_PADDING_PX * scale,
    width: frame.width - (BOARD_HORIZONTAL_PADDING_PX * 2 * scale),
    height: frame.height - ((BOARD_TOP_PADDING_PX + BOARD_BOTTOM_PADDING_PX) * scale)
  };

  const binsRect: Rect = {
    x: boardRect.x,
    y: boardRect.y + boardRect.height + 12 * scale,
    width: boardRect.width,
    height: BINS_HEIGHT_PX * scale
  };

  const buttonRect: Rect = {
    x: frame.x,
    y: frame.y + frame.height,
    width: 0,
    height: 0
  };

  return { frame, boardRect, binsRect, buttonRect };
}

export function getPlinkoAnimationDurationMs(data: Pick<PlinkoDropData, "drops" | "rows">): number {
  if (!data.drops.length) return 0;
  const perDropMs = data.rows * DROP_STEP_MS + DROP_SETTLE_MS;
  return (perDropMs * data.drops.length) + (DROP_GAP_MS * Math.max(0, data.drops.length - 1));
}

export function getPlinkoStepDurationMs() {
  return DROP_STEP_MS;
}

export function getPlinkoDropGapMs() {
  return DROP_GAP_MS;
}

function normalizeDrops(rawDrops: unknown, rows: number, lanes: number): PlinkoDropReplay[] {
  if (!Array.isArray(rawDrops)) return [];

  const normalized: PlinkoDropReplay[] = [];
  const expectedRollLength = rows;

  for (const rawDrop of rawDrops) {
    if (!rawDrop || typeof rawDrop !== "object") continue;
    const typedDrop = rawDrop as Record<string, unknown>;

    const maybeRolls = typedDrop.rolls;
    if (!Array.isArray(maybeRolls) || maybeRolls.length !== expectedRollLength) continue;

    const rolls = maybeRolls.map((roll) => roll === true);
    const trueCount = rolls.reduce((sum, roll) => sum + (roll ? 1 : 0), 0);
    const computedTier = clampTier(trueCount - MIN_TRUE_FOR_TIER);
    const tier = clampTier(toInteger(typedDrop.tier, computedTier));
    const landingLane = clampLane(toInteger(typedDrop.landing_lane, tier - 1), lanes);
    const declaredTrueCount = toInteger(typedDrop.true_count, trueCount);

    normalized.push({
      tier,
      landingLane,
      trueCount: Math.max(0, declaredTrueCount),
      rolls
    });
  }

  return normalized;
}

function toNullableTier(value: unknown): number | null {
  if (typeof value !== "number") return null;
  return clampTier(value);
}

function clampTier(value: number): number {
  return Math.max(MIN_TIER, Math.min(MAX_TIER, Math.round(value)));
}

function clampLane(value: number, laneCount: number): number {
  return Math.max(0, Math.min(laneCount - 1, Math.round(value)));
}

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(value)));
}

function positiveInteger(value: unknown, fallback: number): number {
  return Math.max(1, toInteger(value, fallback));
}

function toInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
