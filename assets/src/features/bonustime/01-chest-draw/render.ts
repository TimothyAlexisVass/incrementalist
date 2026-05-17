import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { ChestDrawData } from "./view-model";
import { ChestState, getChestState } from "./interactions";
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from "../../../config";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
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
    instruction = "CLICK TO REVEAL";
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
