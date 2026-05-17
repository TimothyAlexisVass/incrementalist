import { ServerState } from "../../../net/snapshots";
import { BigNum } from "../../../core/bignum";

export interface ChestDrawData {
  hasToken: boolean;
  lastTier: number | null;
  lastRewardAmount: BigNum | null;
}

export function getChestDrawData(state: ServerState): ChestDrawData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  return {
    hasToken: snapshot.state.has_bonustime_token || db.special_tokens > 0,
    lastTier: db.last_result?.tier ?? null,
    lastRewardAmount: db.last_result?.reward_amount ?? null
  };
}
