import { ServerState } from "../../../net/snapshots";
import { BigNum } from "../../../core/bignum";

export interface JackpotMeterData {
  hasToken: boolean;
  specialTokens: number;
  lastTier: number | null;
  lastRewardAmount: BigNum | null;
  currentProgress: number;
  resultProgress: number | null;
  streak: number;
}

export function getJackpotMeterData(state: ServerState): JackpotMeterData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const lastRes = db.last_result;

  // We check if the last game played was jackpot_meter
  const isJackpotMeterResult = lastRes?.game_id === "jackpot_meter";
  const resultProgress = isJackpotMeterResult && Array.isArray(lastRes?.rolls) ? lastRes.rolls[0] : null;

  return {
    hasToken: !!snapshot.state.has_bonustime_token,
    specialTokens: db.special_tokens || 0,
    lastTier: isJackpotMeterResult ? lastRes?.tier ?? null : null,
    lastRewardAmount: isJackpotMeterResult ? lastRes?.reward_amount ?? null : null,
    currentProgress: db.jackpot_progress || 0,
    resultProgress,
    streak: db.streak || 0
  };
}
