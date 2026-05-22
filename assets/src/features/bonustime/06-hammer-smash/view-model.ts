import bonustimeConfig from "../../../../../shared/requirements/bonustime.json";
import { BigNum } from "../../../core/bignum";
import { ServerState } from "../../../net/snapshots";

export interface SmashResult {
  smash_1_power: number;
  smash_2_power: number;
  smash_3_power: number;
  extra_smash_power: number | null;
  bell_extra_tier: number | null;
}

export interface HammerSmashLastResult {
  game_id: string;
  tier: number;
  reward_amount: BigNum;
  played_at: string;
  smashes: SmashResult;
}

export interface HammerSmashData {
  hasToken: boolean;
  streak: number;
  lastPlayedAt: string | null;
  lastResult: HammerSmashLastResult | null;
  smashes: SmashResult | null;
  rewardTier: number | null;
  rewardAmount: BigNum | null;
  bellHit: boolean;
  bellExtraTier: number | null;
}

const HAMMER_CONFIG = bonustimeConfig as {
  game_rules: {
    hammer_smash?: {
      bell_threshold?: number;
    };
  };
};

export const BELL_THRESHOLD = HAMMER_CONFIG.game_rules.hammer_smash?.bell_threshold ?? 263;
export const SMASH_SETTLE_MS = 1200;
export const POLE_RISE_MS = 800;
export const BELL_HIT_MS = 1400;
export const DISPLAY_SCALE = 1000 / BELL_THRESHOLD;

export function displayPower(totalPower: number): number {
  return Math.round(DISPLAY_SCALE * totalPower);
}

export function getHammerSmashData(state: ServerState): HammerSmashData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const lastResult = db.last_result;
  const isHammerResult = lastResult?.game_id === "hammer_smash";
  const smashes = isHammerResult ? normalizeSmashes(lastResult?.smashes) : null;
  const totalPower = smashes
    ? smashes.smash_1_power + smashes.smash_2_power + smashes.smash_3_power
    : 0;
  const bellHit = totalPower >= BELL_THRESHOLD;

  return {
    hasToken: snapshot.state.has_bonustime_token || db.special_tokens > 0,
    streak: db.streak,
    lastPlayedAt: isHammerResult && typeof lastResult?.played_at === "string" ? lastResult.played_at : null,
    lastResult: isHammerResult ? lastResult as HammerSmashLastResult : null,
    smashes,
    rewardTier: isHammerResult ? toNullableTier(lastResult?.tier) : null,
    rewardAmount: isHammerResult ? (lastResult?.reward_amount ?? null) : null,
    bellHit,
    bellExtraTier: bellHit && smashes ? toNullableTier(smashes.bell_extra_tier) : null
  };
}

function normalizeSmashes(raw: unknown): SmashResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    smash_1_power: toInteger(r.smash_1_power, 1),
    smash_2_power: toInteger(r.smash_2_power, 1),
    smash_3_power: toInteger(r.smash_3_power, 1),
    extra_smash_power: r.extra_smash_power != null ? toInteger(r.extra_smash_power, 1) : null,
    bell_extra_tier: r.bell_extra_tier != null ? toInteger(r.bell_extra_tier, 4) : null
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
