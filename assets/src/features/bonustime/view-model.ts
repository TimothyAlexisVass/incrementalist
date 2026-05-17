import { ServerState } from "../../net/snapshots";
import { getServerNow } from "../../core/time";
import dailyBonusConfig from "../../../../shared/requirements/daily-bonus.json";

const SLOT_MS = 43_200_000; // 12 hours
const SLOT_COUNT = 9;

const GAME_IDS: Record<string, string> = {
  "1": "chest_draw", "2": "prize_wheel", "3": "resource_checklist",
  "4": "coin_rain", "5": "item_checklist", "6": "hammer_smash",
  "7": "plinko_drop", "8": "jackpot_meter", "9": "bonus_time"
};

const GAME_NAMES: Record<string, string> = {
  "chest_draw": "Chest Draw", "prize_wheel": "Prize Wheel", "resource_checklist": "Resource Checklist",
  "coin_rain": "Coin Rain", "item_checklist": "Item Checklist", "hammer_smash": "Hammer Smash",
  "plinko_drop": "Plinko Drop", "jackpot_meter": "Jackpot Meter", "bonus_time": "Bonus Time"
};

export function getActiveGameId(state?: ServerState): string {
  const now = getServerNow();
  let anchorStr = state?.snapshot?.state.daily_bonus?.rotation_anchor;
  if (!anchorStr) {
    anchorStr = dailyBonusConfig.rotation_anchor;
  }
  if (!anchorStr) {
    return "chest_draw";
  }
  const anchor = new Date(anchorStr).getTime();
    
  const elapsed = Math.max(0, now - anchor);
  const boundaryIndex = Math.floor(elapsed / SLOT_MS);
  const activeSlotIndex = (boundaryIndex % SLOT_COUNT) + 1;
  return GAME_IDS[activeSlotIndex.toString()] || "chest_draw";
}

export function getActiveGameName(state?: ServerState): string {
  return GAME_NAMES[getActiveGameId(state)] || "Unknown Game";
}

export function getTimeUntilNextTokenMs(state?: ServerState): number {
  const now = getServerNow();
  let anchorStr = state?.snapshot?.state.daily_bonus?.rotation_anchor;
  if (!anchorStr) {
    anchorStr = dailyBonusConfig.rotation_anchor;
  }
  if (!anchorStr) {
    return SLOT_MS;
  }
  const anchor = new Date(anchorStr).getTime();

  const elapsed = Math.max(0, now - anchor);
  const nextBoundaryIndex = Math.floor(elapsed / SLOT_MS) + 1;
  const nextBoundaryMs = anchor + (nextBoundaryIndex * SLOT_MS);
  return Math.max(0, nextBoundaryMs - now);
}

export function getBonusTimeTooltipData(state: ServerState): string[] | null {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.daily_bonus) return null;

  const db = snapshot.state.daily_bonus;
  const gameName = getActiveGameName(state);
  
  const tooltip = [
    `Current game: ${gameName}`,
    `Special tokens: ${db.special_tokens}`,
    `Streak: ${db.streak}`
  ];

  if (!snapshot.state.has_daily_token) {
    const nextMs = getTimeUntilNextTokenMs(state);
    const hours = Math.floor(nextMs / 3_600_000);
    const mins = Math.floor((nextMs % 3_600_000) / 60_000);
    const secs = Math.floor((nextMs % 60_000) / 1000);
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    tooltip.push(`Next entry in ${timeStr}`);
  }

  return tooltip;
}
