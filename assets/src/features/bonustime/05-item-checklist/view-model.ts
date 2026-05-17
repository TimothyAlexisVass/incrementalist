import { ServerState } from "../../../net/snapshots";
import { BigNum } from "../../../core/bignum";

export interface ItemChecklistEntry {
  entryIndex: number;
  entryNumber: number;
  tier: number;
  completed: boolean;
  active: boolean;
}

export interface ItemChecklistData {
  hasToken: boolean;
  entries: ItemChecklistEntry[];
  nextEntryIndex: number;
  lastTier: number | null;
  lastRewardAmount: BigNum | null;
}

const CHECKLIST_TIERS = [2, 2, 3, 3, 3, 4, 4, 5, 3, 3, 4, 5, 6, 4, 4, 4, 7];

export function getItemChecklistData(state: ServerState): ItemChecklistData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const nextEntryIndex = db.checklist_entry_indexes?.item ?? 0;

  const entries: ItemChecklistEntry[] = Array.from({ length: 17 }, (_, i) => {
    const tier = CHECKLIST_TIERS[i] || 2;
    return {
      entryIndex: i,
      entryNumber: i + 1,
      tier,
      completed: i < nextEntryIndex,
      active: i === nextEntryIndex
    };
  });

  return {
    hasToken: snapshot.state.has_bonustime_token || db.special_tokens > 0,
    entries,
    nextEntryIndex,
    lastTier: db.last_result?.tier ?? null,
    lastRewardAmount: db.last_result?.reward_amount ?? null
  };
}
