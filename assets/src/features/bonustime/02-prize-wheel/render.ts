import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, hslToRgb, type RGBA } from "../../../utils";
import { PrizeWheelData } from "./view-model";
import { WheelState, getWheelState } from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { fitRectWithinBonusTimeArea } from "../layout";
import { renderBonusTimeWelcomeCard } from "../flow";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

const DEFAULT_RGBA = hexToRgba("#4a5568");

export function renderPrizeWheel(
  data: PrizeWheelData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getWheelState();
  const now = performance.now();
  const layout = fitRectWithinBonusTimeArea(rect, 300, 300);

  if (state === WheelState.IDLE) {
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 440,
      cardHeight: 300,
      title: "PRIZE WHEEL",
      bodyLines: ["Spin the wheel for a chance at a massive reward."],
      streakText: `Current Streak: ${data.streak} day${data.streak === 1 ? "" : "s"}`,
      buttonText: "SPIN NOW",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: "#ffbe4d",
      glowColor: [1, 0.745, 0.302, 1],
      backgroundColor: "#120d24",
      buttonActive: false
    });
    return;
  }

  let rgba: RGBA = DEFAULT_RGBA;

  if (state === WheelState.SPINNING) {
    const hue = (now % 1000) / 1000 * 360;
    rgba = hslToRgb(hue, 0.7, 0.5);
  } else if (state === WheelState.SPUN && data.lastTier) {
    const tierConfig = getTierConfig(data.lastTier);
    rgba = hexToRgba(tierConfig?.color || "#ffffff");
  }

  renderer.drawRect({
    x: layout.x, y: layout.y, width: layout.width, height: layout.height,
    color: rgba
  });
}

