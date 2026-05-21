import { ServerState } from "../../../net/snapshots";
import { getActiveGameId } from "../view-model";

export interface LuckyDiceSessionData {
  throwsTotal: number;
  throwsRemaining: number;
  currentDice: number[];
  heldIndexes: number[];
  claimedTiers: number[];
  currentTier: number | null;
  currentOutcome: string | null;
  startedAt: string | null;
}

export interface LuckyDiceData {
  hasToken: boolean;
  streak: number;
  throwsFromStreak: number;
  session: LuckyDiceSessionData | null;
  lastResult: {
    game_id: string;
    tier: number;
    claimed_tiers?: number[];
    dice?: number[];
    reward_amount?: unknown;
    played_at?: string;
  } | null;
}

export function getLuckyDiceThrowsForStreak(streak: number): number {
  if (streak <= 15) return 1;
  if (streak <= 30) return 2;
  return 3;
}

export function getLuckyDiceData(state: ServerState): LuckyDiceData | null {
  const activeGameId = getActiveGameId(state);
  if (activeGameId !== "lucky_dice") return null;

  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const activeSession = db.active_session;
  let session: LuckyDiceSessionData | null = null;

  if (activeSession && activeSession.type === "lucky_dice") {
    const data = activeSession.data as Record<string, unknown>;
    const currentDice =
      Array.isArray(data.current_dice)
        ? data.current_dice.filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 7)
        : [];
    const heldIndexes =
      Array.isArray(data.held_indexes)
        ? data.held_indexes.filter((value): value is number => Number.isInteger(value) && value >= 0 && value <= 6)
        : [];
    const claimedTiers =
      Array.isArray(data.claimed_tiers)
        ? data.claimed_tiers.filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 7)
        : [];

    session = {
      throwsTotal: Number.isInteger(data.throws_total) ? (data.throws_total as number) : 0,
      throwsRemaining: Number.isInteger(data.throws_remaining) ? (data.throws_remaining as number) : 0,
      currentDice,
      heldIndexes,
      claimedTiers,
      currentTier: Number.isInteger(data.current_tier) ? (data.current_tier as number) : null,
      currentOutcome: typeof data.current_outcome === "string" ? data.current_outcome : null,
      startedAt: typeof data.started_at === "string" ? data.started_at : null
    };
  }

  return {
    hasToken: !!snapshot.state.has_bonustime_token || db.special_tokens > 0,
    streak: db.streak ?? 0,
    throwsFromStreak: getLuckyDiceThrowsForStreak(db.streak ?? 0),
    session,
    lastResult: db.last_result?.game_id === "lucky_dice" ? db.last_result : null
  };
}
