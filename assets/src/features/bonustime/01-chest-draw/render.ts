import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { ChestDrawData } from "./view-model";
import { ChestState, getChestState, getLastRewardButtonRect } from "./interactions";
import { MODAL_TITLE_FONT, MODAL_BODY_FONT, DAILY_BONUS_TITLE_FONT, DAILY_BONUS_BUTTON_FONT } from "../../../config";
import { getServerNow } from "../../../core/time";
import { resolveUpdatingText } from "../../../utils/text";
import { drawButton } from "../../../ui/components/button";
import { formatBigNum } from "../../../utils/format";
import dailyBonusConfig from "../../../../../shared/requirements/daily-bonus.json";

function getTierConfig(tier: number) {
  return (dailyBonusConfig.reward_tiers as any)[`tier_${tier}`];
}

const DEFAULT_COLOR = "#4a5568";
const DEFAULT_LABEL = "?";

export function renderChestDraw(
  data: ChestDrawData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getChestState();
  const now = performance.now();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  if (state === ChestState.IDLE && !data.hasToken) {
    // Cooldown UI
    const nowServer = getServerNow();
    const tomorrow = new Date(nowServer);
    tomorrow.setUTCHours(24, 0, 0, 0);
    const remainingMs = tomorrow.getTime() - nowServer;

    const countdownStr = formatCountdown(remainingMs);
    const stableCountdown = resolveUpdatingText("chest_draw_countdown", countdownStr, (text) => renderer.isTextReady(text, DAILY_BONUS_TITLE_FONT));

    renderer.drawText({
      text: "TIME UNTIL NEXT ENTRY",
      x: centerX, y: centerY - 60, font: MODAL_BODY_FONT,
      color: "#718096", align: 'center', baseline: 'middle'
    });

    renderer.drawText({
      text: stableCountdown,
      x: centerX, y: centerY, font: DAILY_BONUS_TITLE_FONT,
      color: "#edf2f7", align: 'center', baseline: 'middle'
    });

    if (data.lastTier) {
      const buttonRect = getLastRewardButtonRect(centerX, centerY + 80);
      drawButton(buttonRect, "VIEW LAST REWARD", {
        font: DAILY_BONUS_BUTTON_FONT,
        active: false // Interaction will handle hover
      });
    }

    return;
  }

  const chestSize = 120;
  const chestX = centerX - chestSize / 2;
  const chestY = centerY - chestSize / 2;

  let color = DEFAULT_COLOR;
  let label = DEFAULT_LABEL;

  if (state === ChestState.REVEALING) {
    const hue = (now % 1000) / 1000 * 360;
    color = `hsl(${hue}, 70%, 50%)`;
    label = "REVEALING...";
  } else if (state === ChestState.REVEALED && data.lastTier) {
    const tierConfig = getTierConfig(data.lastTier);
    color = tierConfig?.color || "#ffffff";
    label = (tierConfig?.rarity || "UNKNOWN").toUpperCase();
  }

  renderer.drawRect({
    x: chestX, y: chestY, width: chestSize, height: chestSize,
    color: color.startsWith("#") ? hexToRgba(color) : cssToRgba(color)
  });

  renderer.drawText({
    text: label, x: centerX, y: chestY - 20, font: MODAL_TITLE_FONT,
    color: color.startsWith("#") ? color : "#fff", align: 'center', baseline: 'alphabetic'
  });

  let instruction = "";
  if (state === ChestState.IDLE) {
    instruction = data.hasToken ? "CLICK TO REVEAL" : ""; // Handled by cooldown above
  } else if (state === ChestState.REVEALED) {
    instruction = "CLICK TO OPEN";
  }

  if (instruction) {
    renderer.drawText({
      text: instruction, x: centerX, y: chestY + chestSize + 40,
      font: MODAL_BODY_FONT, color: "#a0aec0", align: 'center', baseline: 'alphabetic'
    });
  }
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
