import { ServerState } from "../../../net/snapshots";
import { getActiveGameId } from "../view-model";

export interface MatchPairsData {
  hasToken: boolean;
  streak: number;
  lastResult?: {
    results: { kind: "miss" | "match"; tier?: string }[];
    token_type: string;
    started_at: string;
  };
}

export function getMatchPairsData(state: ServerState): MatchPairsData | null {
  const activeGameId = getActiveGameId(state);
  if (activeGameId !== "match_pairs") return null;

  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const hasToken = !!snapshot.state.has_bonustime_token || db.special_tokens > 0;
  
  let lastResult: MatchPairsData["lastResult"] | undefined;

  if (db.active_session && db.active_session.type === "match_pairs") {
    const sessionData = db.active_session.data as any;
    lastResult = {
      results: sessionData.results,
      token_type: sessionData.token_type,
      started_at: sessionData.started_at
    };
  }

  return {
    hasToken,
    streak: db.streak,
    lastResult
  };
}
