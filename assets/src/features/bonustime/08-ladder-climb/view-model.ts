import bonustimeConfig from "../../../../../shared/requirements/bonustime.json";
import { BigNum } from "../../../core/bignum";
import { ServerState } from "../../../net/snapshots";

export interface LadderClimbStep {
  from_rung: number;
  target_rung: number;
  success: boolean;
  chance: number;
  reached_rung: number;
}

export interface LadderClimbLastResult {
  game_id: string;
  tier: number;
  rolls: LadderClimbStep[];
  reward_amount: BigNum;
  played_at: string;
}

export interface LadderClimbData {
  hasToken: boolean;
  streak: number;
  lastPlayedAt: string | null;
  lastResult: LadderClimbLastResult | null;
  path: LadderClimbStep[];
  highestRung: number;
  rewardTier: number | null;
  rewardAmount: BigNum | null;
}

const BONUS_TIME_CONFIG = bonustimeConfig as {
  game_rules: {
    ladder_climb?: {
      visible_rungs?: number;
      reward_cap_rung?: number;
    };
  };
};

export const LADDER_CLIMB_VISIBLE_RUNGS = BONUS_TIME_CONFIG.game_rules.ladder_climb?.visible_rungs ?? 20;
export const LADDER_CLIMB_REWARD_CAP_RUNG = BONUS_TIME_CONFIG.game_rules.ladder_climb?.reward_cap_rung ?? 7;
export const LADDER_CLIMB_STEP_ANIMATION_MS = 540;

export function getLadderClimbAnimationDurationMs(data: Pick<LadderClimbData, "path">): number {
  void data;
  return LADDER_CLIMB_STEP_ANIMATION_MS;
}

export function getLadderClimbData(state: ServerState): LadderClimbData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const lastResult = db.last_result;
  const isLadderResult = lastResult?.game_id === "ladder_climb";
  const path = isLadderResult ? normalizePath(lastResult?.rolls) : [];
  const highestRung = path.length > 0 ? path[path.length - 1].reached_rung : 1;

  return {
    hasToken: snapshot.state.has_bonustime_token || db.special_tokens > 0,
    streak: db.streak,
    lastPlayedAt: isLadderResult && typeof lastResult?.played_at === "string" ? lastResult.played_at : null,
    lastResult: isLadderResult ? lastResult : null,
    path,
    highestRung,
    rewardTier: isLadderResult ? toNullableTier(lastResult?.tier) : null,
    rewardAmount: isLadderResult ? (lastResult?.reward_amount ?? null) : null
  };
}

function normalizePath(rawPath: unknown): LadderClimbStep[] {
  if (!Array.isArray(rawPath)) return [];

  return rawPath
    .map((step) => normalizeStep(step))
    .filter((step): step is LadderClimbStep => step !== null);
}

function normalizeStep(step: unknown): LadderClimbStep | null {
  if (!step || typeof step !== "object") return null;

  const rawStep = step as Record<string, unknown>;
  const fromRung = toInteger(rawStep.from_rung ?? rawStep.fromRung, 1);
  const targetRung = toInteger(rawStep.target_rung ?? rawStep.targetRung, fromRung + 1);

  return {
    from_rung: fromRung,
    target_rung: targetRung,
    success: rawStep.success === true,
    chance: toNumber(rawStep.chance, 0),
    reached_rung: toInteger(rawStep.reached_rung ?? rawStep.reachedRung, fromRung)
  };
}

function toNullableTier(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.min(7, Math.round(value)));
}

function toInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
