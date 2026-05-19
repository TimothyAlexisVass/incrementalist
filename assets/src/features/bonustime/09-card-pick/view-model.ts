import { ServerState } from "../../../net/snapshots";
import { BigNum } from "../../../core/bignum";

export interface CardPickData {
  hasToken: boolean;
  streak: number;
  bonustimeFlips: number;
  lastResult: {
    game_id: string;
    tier: number;
    flips: number;
    board: { tier: number; multiplier: number }[];
    reward_amount: BigNum;
    played_at: string;
  } | null;
}

export function getCardPickData(state: ServerState): CardPickData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  return {
    hasToken: snapshot.state.has_bonustime_token || db.special_tokens > 0,
    streak: db.streak,
    bonustimeFlips: db.bonustime_flips ?? 0,
    lastResult: db.last_result?.game_id === "card_pick" ? db.last_result : null
  };
}
