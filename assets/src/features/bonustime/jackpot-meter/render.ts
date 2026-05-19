import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, cssToRgba } from "../../../utils";
import { JackpotMeterData } from "./view-model";
import { JackpotState, getJackpotState } from "./interactions";
import { fitRectWithinBonusTimeArea } from "../layout";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

export function renderJackpotMeter(
  data: JackpotMeterData,
  rect: { x: number; y: number; width: number; height: number }
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const now = performance.now();
  const state = getJackpotState();
  const layout = fitRectWithinBonusTimeArea(rect, 300, 300);

  // Background container
  renderer.drawRect({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    color: hexToRgba("#1a202c")
  });

  // Title
  renderer.drawText({
    text: "JACKPOT",
    x: layout.x + layout.width / 2,
    y: layout.y + 35 * layout.scale,
    font: `bold ${Math.round(20 * layout.scale)}px 'Outfit', sans-serif`,
    color: "#ffffff",
    align: "center"
  });

  // Calculate win probability chance percent exactly matching the server rules
  const baseChance = 0.005;
  const missIncrement = 0.005;
  const streak = data.streak || 0;
  const streakBonus = Math.min(Math.floor(streak / 100) * 0.01, 0.01);

  // Determine progressive visual state
  let displayedProgress = data.currentProgress;
  if (state === JackpotState.ROLLING) {
    displayedProgress = Math.floor(now / 100) % 15; // 0 to 14
  } else if (state === JackpotState.REVEALED && data.resultProgress !== null) {
    displayedProgress = data.resultProgress;
  }

  const isGuaranteed = displayedProgress >= 13;
  const probability = isGuaranteed 
    ? 1.0 
    : Math.min(1.0, baseChance + streakBonus + displayedProgress * missIncrement);
  const chancePercent = probability * 100;

  // Dynamic Instructions
  let instruction = "SPEND 1 DAILY TOKEN TO TRY YOUR LUCK!";
  if (!data.hasToken && data.specialTokens > 0) {
    instruction = "DAILY TOKEN REQUIRED (SPECIALS CANNOT BE USED)";
  } else if (isGuaranteed) {
    instruction = "14TH PLAY: 100% GUARANTEED DIVINE REWARD!";
  } else {
    instruction = "Guaranteed when meter is full";
  }

  renderer.drawText({
    text: instruction,
    x: layout.x + layout.width / 2,
    y: layout.y + 52 * layout.scale,
    font: `${Math.round(10 * layout.scale)}px 'Inter', sans-serif`,
    color: (!data.hasToken && data.specialTokens > 0) ? "#e53e3e" : "#a0aec0",
    align: "center"
  });

  // Calculate coordinates for Probability Gauge (glowing circular reactor core)
  const centerX = layout.x + layout.width / 2;
  const centerY = layout.y + 145 * layout.scale;
  const radius = 58 * layout.scale;
  const thickness = 8 * layout.scale;

  // 1. Draw outer progressive tick marks (14 circular slots representing the pity limit)
  for (let i = 0; i < 14; i++) {
    const angle = -Math.PI / 2 + ((i + 1) / 14) * 2 * Math.PI;
    const dotX = centerX + Math.cos(angle) * (radius + 18 * layout.scale);
    const dotY = centerY + Math.sin(angle) * (radius + 18 * layout.scale);

    const isStarred = i === 13;
    const isFilledDot = i < displayedProgress;

    let dotColor = hexToRgba("#2d3748");
    if (isStarred) {
      if (displayedProgress >= 14 || (state === JackpotState.REVEALED && data.lastTier === 7)) {
        const hue = (now % 1000) / 1000 * 360;
        dotColor = cssToRgba(`hsl(${hue}, 90%, 55%)`);
      } else {
        dotColor = hexToRgba("#ffbe4d");
      }
    } else if (isFilledDot) {
      dotColor = hexToRgba("#3182ce");
    }

    renderer.drawCircle(dotX, dotY, (isStarred ? 4.5 : 2.5) * layout.scale, dotColor);
  }

  // 2. Draw background ring
  renderer.drawRing(centerX, centerY, radius, thickness, hexToRgba("#1a202c"));

  // 3. Draw progressive active arc
  if (displayedProgress > 0) {
    const arcStart = -Math.PI / 2;
    const arcEnd = -Math.PI / 2 + Math.min(1.0, displayedProgress / 14) * 2 * Math.PI;
    
    let arcColor = hexToRgba("#3182ce");
    if (isGuaranteed) {
      const hue = (now % 1000) / 1000 * 360;
      arcColor = cssToRgba(`hsl(${hue}, 80%, 50%)`);
    }

    renderer.drawArc(centerX, centerY, radius, thickness, arcStart, arcEnd, arcColor);
  }

  // 4. Render win percentage inside the reactor core
  renderer.drawText({
    text: isGuaranteed ? "100%" : `${chancePercent.toFixed(1)}%`,
    x: centerX,
    y: centerY - 3 * layout.scale,
    font: `bold ${Math.round(24 * layout.scale)}px 'Outfit', sans-serif`,
    color: isGuaranteed ? "#ffbe4d" : "#ffffff",
    align: "center",
    baseline: "middle"
  });

  renderer.drawText({
    text: "JACKPOT",
    x: centerX,
    y: centerY + 16 * layout.scale,
    font: `${Math.round(9 * layout.scale)}px 'Inter', sans-serif`,
    color: "#718096",
    align: "center",
    baseline: "middle"
  });

  renderer.drawText({
    text: "CHANCE",
    x: centerX,
    y: centerY + 27 * layout.scale,
    font: `${Math.round(9 * layout.scale)}px 'Inter', sans-serif`,
    color: "#718096",
    align: "center",
    baseline: "middle"
  });

  // Draw bottom play/claim button
  const btnWidth = 180 * layout.scale;
  const btnHeight = 40 * layout.scale;
  const btnX = layout.x + (layout.width - btnWidth) / 2;
  const btnY = layout.y + layout.height - btnHeight - 20 * layout.scale;

  let btnText = "TRY JACKPOT";
  let btnColor = "#3182ce";
  if (state === JackpotState.ROLLING) {
    btnText = "ROLLING...";
    const hue = (now % 1000) / 1000 * 360;
    btnColor = `hsl(${hue}, 70%, 50%)`;
  } else if (state === JackpotState.REVEALED) {
    btnText = "CLAIM REWARD!";
    if (data.lastTier) {
      const config = getTierConfig(data.lastTier);
      btnColor = config?.color || "#48bb78";
    } else {
      btnColor = "#48bb78";
    }
  }

  let btnTextColor = "#ffffff";
  if (state === JackpotState.REVEALED && data.lastTier === 1) {
    btnTextColor = "#1a202c";
  }

  // Draw background button rect
  renderer.drawRect({
    x: btnX,
    y: btnY,
    width: btnWidth,
    height: btnHeight,
    color: cssToRgba(btnColor)
  });

  renderer.drawText({
    text: btnText,
    x: btnX + btnWidth / 2,
    y: btnY + btnHeight / 2 + 5 * layout.scale,
    font: `bold ${Math.round(13 * layout.scale)}px 'Inter', sans-serif`,
    color: btnTextColor,
    align: "center"
  });
}
