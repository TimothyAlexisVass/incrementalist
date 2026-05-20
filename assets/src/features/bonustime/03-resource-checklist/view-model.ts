import { ServerState } from "../../../net/snapshots";
import { BigNum } from "../../../core/bignum";
import bonustimeConfig from "../../../../../shared/requirements/bonustime.json";

export interface ResourceChecklistEntry {
  entryIndex: number;
  entryNumber: number;
  tier: number;
  completed: boolean;
  active: boolean;
}

export interface ResourceChecklistData {
  hasToken: boolean;
  entries: ResourceChecklistEntry[];
  nextEntryIndex: number;
  lastTier: number | null;
  lastRewardAmount: BigNum | null;
}

const CHECKLIST_ENTRIES = (bonustimeConfig as {
  game_rules: {
    checklists: {
      entries: number[];
    };
  };
}).game_rules.checklists.entries;

function normalizeChecklistEntryIndex(value: unknown, entryCount: number): number {
  const index = typeof value === "number" ? Math.floor(value) : Number(value);
  return Number.isInteger(index) && index >= 0 && index < entryCount ? index : 0;
}

export function getResourceChecklistData(state: ServerState): ResourceChecklistData | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const nextEntryIndex = normalizeChecklistEntryIndex(
    db.checklist_entry_indexes?.resource,
    CHECKLIST_ENTRIES.length
  );

  const entries: ResourceChecklistEntry[] = CHECKLIST_ENTRIES.map((tier, i) => {
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
