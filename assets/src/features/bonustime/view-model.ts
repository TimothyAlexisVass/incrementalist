import { ServerState } from "../../net/snapshots";
import { getServerNow } from "../../core/time";
import bonustimeConfig from "../../../../shared/requirements/bonustime.json";
import climateConfig from "../../../../shared/requirements/climate.json";
import { formatDuration } from "../../utils/format";

const SLOT_MS = 43_200_000; // 12 hours

type BonusTimeConfig = {
  games: Record<string, { name: string; slot: number }>;
};

const bonusTimeConfig = bonustimeConfig as BonusTimeConfig;
const climateSharedConfig = climateConfig as { epoch_utc: string };

function getGameIdForSlot(slot: number): string {
  const match = Object.entries(bonusTimeConfig.games).find(([, game]) => game.slot === slot);
  return match?.[0] || "chest_draw";
}

export function getActiveGameId(state?: ServerState): string {
  const serverActiveGameId = state?.snapshot?.state.bonustime?.active_game_id;
  if (serverActiveGameId) {
    return serverActiveGameId;
  }

  const now = getServerNow();
  const anchorStr = state?.snapshot?.state.climate?.epoch_at || climateSharedConfig.epoch_utc;
  if (!anchorStr) {
    return "chest_draw";
  }
  const anchor = new Date(anchorStr).getTime();

  if (Number.isNaN(anchor)) {
    return "chest_draw";
  }

  const elapsed = Math.max(0, now - anchor);
  const slotCount = Math.max(1, Object.keys(bonusTimeConfig.games).length);
  const boundaryIndex = Math.floor(elapsed / SLOT_MS);
  const activeSlotIndex = (boundaryIndex % slotCount) + 1;
  return getGameIdForSlot(activeSlotIndex);
}

export function getActiveGameName(state?: ServerState): string {
  return bonusTimeConfig.games[getActiveGameId(state)]?.name || "Unknown Game";
}

export function getTimeUntilNextTokenMs(state?: ServerState): number {
  const now = getServerNow();
  const anchorStr = state?.snapshot?.state.climate?.epoch_at || climateSharedConfig.epoch_utc;
  if (!anchorStr) {
    return SLOT_MS;
  }
  const anchor = new Date(anchorStr).getTime();

  const elapsed = Math.max(0, now - anchor);
  const nextBoundaryIndex = Math.floor(elapsed / SLOT_MS) + 1;
  const nextBoundaryMs = anchor + (nextBoundaryIndex * SLOT_MS);
  return Math.max(0, nextBoundaryMs - now);
}

export function getBonusTimeTooltipData(state: ServerState) {
  const snapshot = state.snapshot;
  if (!snapshot || !snapshot.state.bonustime) return null;

  const db = snapshot.state.bonustime;
  const gameName = getActiveGameName(state);
  
  const tooltip = [
    { label: "Current game:", value: gameName },
    { label: "Special tokens:", value: String(db.special_tokens) },
    { label: "Streak:", value: String(db.streak) }
  ];

  if (!snapshot.state.has_bonustime_token) {
    const nextMs = getTimeUntilNextTokenMs(state);
    const timeStr = formatDuration(nextMs / 1000);
    tooltip.push({ label: "Next entry in:", value: timeStr });
  }

  return tooltip;
}
