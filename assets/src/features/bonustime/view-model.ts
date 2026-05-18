import { ServerState } from "../../net/snapshots";
import { getServerNow } from "../../core/time";
import bonustimeConfig from "../../../../shared/requirements/bonustime.json";

const SLOT_MS = 43_200_000; // 12 hours

type BonusTimeConfig = {
  rotation_slot_count: number;
  rotation_anchor: string;
  rotation: Record<string, string>;
  games: Record<string, { name: string; slot: number }>;
};

const bonusTimeConfig = bonustimeConfig as BonusTimeConfig;

export function getActiveGameId(state?: ServerState): string {
  const serverActiveGameId = state?.snapshot?.state.bonustime?.active_game_id;
  if (serverActiveGameId) {
    return serverActiveGameId;
  }

  const now = getServerNow();
  let anchorStr = state?.snapshot?.state.bonustime?.rotation_anchor;
  if (!anchorStr) {
    anchorStr = bonusTimeConfig.rotation_anchor;
  }
  if (!anchorStr) {
    return "chest_draw";
  }
  const anchor = new Date(anchorStr).getTime();

  if (Number.isNaN(anchor)) {
    return "chest_draw";
  }

  const elapsed = Math.max(0, now - anchor);
  const slotCount = Math.max(1, bonusTimeConfig.rotation_slot_count || 15);
  const boundaryIndex = Math.floor(elapsed / SLOT_MS);
  const activeSlotIndex = (boundaryIndex % slotCount) + 1;
  return bonusTimeConfig.rotation[activeSlotIndex.toString()] || "chest_draw";
}

export function getActiveGameName(state?: ServerState): string {
  return bonusTimeConfig.games[getActiveGameId(state)]?.name || "Unknown Game";
}

export function getTimeUntilNextTokenMs(state?: ServerState): number {
  const now = getServerNow();
  let anchorStr = state?.snapshot?.state.bonustime?.rotation_anchor;
  if (!anchorStr) {
    anchorStr = bonustimeConfig.rotation_anchor;
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
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const gameName = getActiveGameName(state);
  
  const tooltip = [
    `Current game: ${gameName}`,
    `Special tokens: ${db.special_tokens}`,
    `Streak: ${db.streak}`
  ];

  if (!snapshot.state.has_bonustime_token) {
    const nextMs = getTimeUntilNextTokenMs(state);
    const hours = Math.floor(nextMs / 3_600_000);
    const mins = Math.floor((nextMs % 3_600_000) / 60_000);
    const secs = Math.floor((nextMs % 60_000) / 1000);
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    tooltip.push(`Next entry in ${timeStr}`);
  }

  return tooltip;
}
