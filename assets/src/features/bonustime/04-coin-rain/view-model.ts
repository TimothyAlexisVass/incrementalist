import { ServerState } from "../../../net/snapshots";
import { BigNum } from "../../../core/bignum";

export interface CoinRainData {
  hasToken: boolean;
  lastTier: number | null;
  lastRewardAmount: BigNum | null;
  streak: number;
  activeSession: {
    type: string;
    data: {
      seed: number;
      timer: number;
      bucket_width: number;
      bucket_speed: number;
    };
  } | null;
}

export function getCoinRainData(state: ServerState): CoinRainData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  let activeSession: CoinRainData["activeSession"] = null;

  if (db.active_session && db.active_session.type === "coin_rain") {
    const sessionData = db.active_session.data as Record<string, unknown>;
    const seed = Number(sessionData.seed);
    const timer = Number(sessionData.timer);
    const bucketWidth = Number(sessionData.bucket_width);
    const bucketSpeed = Number(sessionData.bucket_speed);

    if (
      Number.isFinite(seed) &&
      Number.isFinite(timer) &&
      Number.isFinite(bucketWidth) &&
      Number.isFinite(bucketSpeed)
    ) {
      activeSession = {
        type: "coin_rain",
        data: {
          seed,
          timer,
          bucket_width: bucketWidth,
          bucket_speed: bucketSpeed
        }
      };
    }
  }

  return {
    hasToken: snapshot.state.has_bonustime_token || db.special_tokens > 0,
    lastTier: db.last_result?.tier ?? null,
    lastRewardAmount: db.last_result?.reward_amount ?? null,
    streak: db.streak ?? 0,
    activeSession
  };
}
