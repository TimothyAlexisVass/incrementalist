import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { ChestDrawData } from "./view-model";
import { ChestState, getChestState } from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { fitRectWithinBonusTimeArea } from "../layout";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

const DEFAULT_COLOR = "#4a5568";

export function renderChestDraw(
  data: ChestDrawData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getChestState();
  const now = performance.now();
  const layout = fitRectWithinBonusTimeArea(rect, 300, 300);

  let color = DEFAULT_COLOR;

  if (state === ChestState.REVEALING) {
    const hue = (now % 1000) / 1000 * 360;
    color = `hsl(${hue}, 70%, 50%)`;
  } else if (state === ChestState.REVEALED && data.lastTier) {
    const tierConfig = getTierConfig(data.lastTier);
    color = tierConfig?.color || "#ffffff";
  }

  renderer.drawRect({
    x: layout.x, y: layout.y, width: layout.width, height: layout.height,
    color: color.startsWith("#") ? hexToRgba(color) : cssToRgba(color)
  });
}
