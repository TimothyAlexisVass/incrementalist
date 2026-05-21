import { ServerState } from "../../../net/snapshots";
import { BigNum } from "../../../core/bignum";

export interface ScratchCardReveal {
  pixels: number;
  tier: number;
}

export interface ScratchCardLastResult {
  game_id: "scratch_card";
  tier: number;
  pixels_budget: number;
  reveal_schedule: ScratchCardReveal[];
  reward_amount: BigNum;
  played_at: string;
}

export interface ScratchCardData {
  hasToken: boolean;
  streak: number;
  lastResult: ScratchCardLastResult | null;
}

export function getScratchCardData(state: ServerState): ScratchCardData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;

  return {
    hasToken: snapshot.state.has_bonustime_token || db.special_tokens > 0,
    streak: db.streak,
    lastResult: db.last_result?.game_id === "scratch_card" ? db.last_result : null
  };
}
