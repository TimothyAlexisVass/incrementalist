import { getActiveWebGLRenderer } from "../../renderer/webgl";
import { hexToRgba } from "../../utils";
import { ServerState } from "../../net/snapshots";
import { InteractionState } from "../../ui/managers/interactions";
import { COLORS } from "../../colors";
import { 
  DISPLAY_AREA_X, 
  DISPLAY_AREA_Y, 
  DISPLAY_AREA_WIDTH, 
  DISPLAY_AREA_HEIGHT,
  DAILY_BONUS_TITLE_FONT
} from "../../config";

const ROTATION_ANCHOR_MS = new Date("2024-01-01T00:00:00Z").getTime();
const SLOT_MS = 43_200_000; // 12 hours
const SLOT_COUNT = 9;

export function getActiveGameName(): string {
  const gameId = getActiveGameId();
  return GAME_NAMES[gameId] || "Unknown Game";
}

export function getTimeUntilNextTokenMs(): number {
  const now = Date.now();
  const elapsed = Math.max(0, now - ROTATION_ANCHOR_MS);
  const nextBoundaryIndex = Math.floor(elapsed / SLOT_MS) + 1;
  const nextBoundaryMs = ROTATION_ANCHOR_MS + (nextBoundaryIndex * SLOT_MS);
  return Math.max(0, nextBoundaryMs - now);
}

const GAME_NAMES: Record<string, string> = {
  "chest_draw": "Chest Draw",
  "prize_wheel": "Prize Wheel",
  "resource_checklist": "Resource Checklist",
  "coin_rain": "Coin Rain",
  "item_checklist": "Item Checklist",
  "hammer_smash": "Hammer Smash",
  "plinko_drop": "Plinko Drop",
  "jackpot_meter": "Jackpot Meter",
  "bonus_time": "Bonus Time"
};

const ROTATION: Record<string, string> = {
  "1": "chest_draw",
  "2": "prize_wheel",
  "3": "resource_checklist",
  "4": "coin_rain",
  "5": "item_checklist",
  "6": "hammer_smash",
  "7": "plinko_drop",
  "8": "jackpot_meter",
  "9": "bonus_time"
};

export function renderBonusTimeOverview(
  canvas: HTMLCanvasElement,
  input: InteractionState,
  state: ServerState
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  // Normal panel background for the game area
  renderer.drawRect({
    x: DISPLAY_AREA_X,
    y: DISPLAY_AREA_Y,
    width: DISPLAY_AREA_WIDTH,
    height: DISPLAY_AREA_HEIGHT,
    color: hexToRgba(COLORS.panel.bg)
  });

  const snapshot = state.snapshot;
  if (!snapshot) return;

  // The mini-game logic will fill the entire DISPLAY_AREA.
  // We use the standard title font for the placeholder.
  renderer.drawText({
    text: "[ MINI-GAME CONTENT AREA ]",
    x: DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2,
    y: DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT / 2,
    font: DAILY_BONUS_TITLE_FONT,
    color: "rgba(255, 255, 255, 0.4)",
    align: 'center',
    baseline: 'middle'
  });
}

function getActiveGameId(): string {
  const now = Date.now();
  const elapsed = Math.max(0, now - ROTATION_ANCHOR_MS);
  const boundaryIndex = Math.floor(elapsed / SLOT_MS);
  const activeSlotIndex = (boundaryIndex % SLOT_COUNT) + 1;
  return ROTATION[activeSlotIndex.toString()] || "chest_draw";
}
