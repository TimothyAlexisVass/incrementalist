import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { PrizeWheelData } from "./view-model";
import { WheelState, getWheelState } from "./interactions";
import { MODAL_TITLE_FONT, MODAL_BODY_FONT } from "../../../config";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

const DEFAULT_COLOR = "#4a5568";
const DEFAULT_LABEL = "?";

export function renderPrizeWheel(
  data: PrizeWheelData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getWheelState();
  const now = performance.now();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const size = 300;
  const wheelX = centerX - size / 2;
  const wheelY = centerY - size / 2;

  let color = DEFAULT_COLOR;
  let label = DEFAULT_LABEL;

  if (state === WheelState.SPINNING) {
    const hue = (now % 1000) / 1000 * 360;
    color = `hsl(${hue}, 70%, 50%)`;
    label = "SPINNING...";
  } else if (state === WheelState.SPUN && data.lastTier) {
    const tierConfig = getTierConfig(data.lastTier);
    color = tierConfig?.color || "#ffffff";
    label = (tierConfig?.rarity || "UNKNOWN").toUpperCase();
  }

  renderer.drawRect({
    x: wheelX, y: wheelY, width: size, height: size,
    color: color.startsWith("#") ? hexToRgba(color) : cssToRgba(color)
  });

  renderer.drawText({
    text: label, x: centerX, y: wheelY - 20, font: MODAL_TITLE_FONT,
    color: color.startsWith("#") ? color : "#fff", align: 'center', baseline: 'alphabetic'
  });

  let instruction = "";
  if (state === WheelState.IDLE) {
    instruction = "CLICK TO SPIN";
  } else if (state === WheelState.SPUN) {
    instruction = "CLICK TO CLAIM";
  }

  if (instruction) {
    renderer.drawText({
      text: instruction, x: centerX, y: wheelY + size + 40,
      font: MODAL_BODY_FONT, color: "#a0aec0", align: 'center', baseline: 'alphabetic'
    });
  }
}
