import bonustimeConfig from "../../../../../shared/requirements/bonustime.json";
import { getRewardTierLabelColor } from "../../../colors";
import { BONUSTIME_TIMER_FONT, BONUSTIME_BODY_FONT } from "../../../config";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  renderBonusTimeWelcomeCard
} from "../flow";
import {
  HammerSmashData,
  BELL_THRESHOLD,
  displayPower,
  SMASH_SETTLE_MS
} from "./view-model";
import {
  HammerSmashState,
  getHammerSmashState,
  getSmashAnimationProgress,
  getPoleRiseProgress,
  getBellHitProgress,
  isSmashClicked,
  getClickPowerVal,
  getSweepValue,
  getSmashButtonRect,
  getSettleFillPercent,
  getStrikerRiseProgress
} from "./interactions";
import { drawButton } from "../../../ui/components/button";
import { isPointInRect } from "../flow";

const REWARD_TIERS = bonustimeConfig as {
  reward_tiers: Record<string, { color?: string; rarity?: string }>;
};

function getTierColor(tier: number): string {
  return REWARD_TIERS.reward_tiers[`tier_${Math.max(1, Math.min(7, tier))}`]?.color || "#ffffff";
}

function getTierRarity(tier: number): string {
  return REWARD_TIERS.reward_tiers[`tier_${Math.max(1, Math.min(7, tier))}`]?.rarity || "Common";
}

// Tier thresholds from config for rendering tier-colored tower segments
const TIER_THRESHOLDS = bonustimeConfig.game_rules.hammer_smash.tier_thresholds;

export function renderHammerSmash(
  data: HammerSmashData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getHammerSmashState();

  if (state === HammerSmashState.IDLE) {
    renderWelcomeCard(data, rect, pointer);
    return;
  }

  // Background
  renderer.drawGradientRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    colorStart: hexToRgba("#080810", 1),
    colorEnd: hexToRgba("#101028", 1),
    alpha: 1
  });

  if (state === HammerSmashState.PREPARING) {
    renderer.drawText({
      text: "PREPARING...",
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      font: BONUSTIME_TIMER_FONT,
      color: "#ffbe4d",
      align: "center",
      baseline: "middle"
    });
    return;
  }

  const smashes = data.smashes;
  if (!smashes) return;

  const totalPower = smashes.smash_1_power + smashes.smash_2_power + smashes.smash_3_power;

  // Layout
  const towerWidth = 60;
  const towerX = rect.x + rect.width - 100;
  const towerTop = rect.y + 30;
  const towerBottom = rect.y + rect.height - 100;
  const towerHeight = towerBottom - towerTop;

  // Draw striker tower
  renderTower(renderer, towerX, towerTop, towerWidth, towerHeight);

  // Determine current visual state
  const now = performance.now();
  const smashPhase = getSmashPhaseIndex(state);
  if (state === HammerSmashState.SMASH_1 ||
      state === HammerSmashState.SMASH_2 ||
      state === HammerSmashState.SMASH_3) {
    
    // Draw power bar
    const smashPower = getSmashPower(smashes, smashPhase);
    let fillPercent = 0;
    if (!isSmashClicked()) {
      fillPercent = getSweepValue(now);
    } else {
      fillPercent = getSettleFillPercent(now, smashPower / 100);
    }

    renderPowerBar(renderer, rect, fillPercent);

    // Draw manual SMASH! button when sweep is active
    if (!isSmashClicked()) {
      const btnRect = getSmashButtonRect(rect);
      const isHovered = !!pointer && isPointInRect(pointer, btnRect);
      drawButton(btnRect, "SMASH!", {
        font: "bold 20px 'Outfit'",
        active: isHovered
      });
    }

    // Smash label
    renderer.drawText({
      text: `SMASH ${smashPhase + 1} / 3`,
      x: rect.x + rect.width / 2,
      y: rect.y + 30,
      font: BONUSTIME_BODY_FONT,
      color: "#a0aec0",
      align: "center",
      baseline: "middle"
    });

    // Draw cumulative power on tower (striker rises when hammer hits)
    let cumulativePower = 0;
    const riseProgress = getStrikerRiseProgress();
    if (smashPhase === 0) {
      cumulativePower = lerp(0, smashes.smash_1_power, easeOutCubic(riseProgress));
    } else if (smashPhase === 1) {
      cumulativePower = smashes.smash_1_power + lerp(0, smashes.smash_2_power, easeOutCubic(riseProgress));
    } else if (smashPhase === 2) {
      cumulativePower = (smashes.smash_1_power + smashes.smash_2_power) + lerp(0, smashes.smash_3_power, easeOutCubic(riseProgress));
    }
    renderPoleMarker(renderer, towerX, towerTop, towerWidth, towerHeight, cumulativePower);
  }

  if (state === HammerSmashState.POLE_RISING) {
    const progress = getPoleRiseProgress();
    const easedPower = Math.round(totalPower * easeOutCubic(progress));
    renderPoleMarker(renderer, towerX, towerTop, towerWidth, towerHeight, easedPower);

    renderer.drawText({
      text: `POWER: ${displayPower(easedPower)}`,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      font: BONUSTIME_TIMER_FONT,
      color: "#ffbe4d",
      align: "center",
      baseline: "middle"
    });
  }

  if (state === HammerSmashState.BELL_HIT) {
    renderPoleMarker(renderer, towerX, towerTop, towerWidth, towerHeight, totalPower);
    renderBellHitEffect(renderer, towerX + towerWidth / 2, towerTop, getBellHitProgress());

    const extraTier = data.bellExtraTier ?? 7;
    renderer.drawText({
      text: `BELL HIT! ${getTierRarity(extraTier).toUpperCase()} BONUS!`,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      font: BONUSTIME_TIMER_FONT,
      color: getTierColor(extraTier),
      align: "center",
      baseline: "middle"
    });
  }

  if (state === HammerSmashState.REVEALED) {
    renderPoleMarker(renderer, towerX, towerTop, towerWidth, towerHeight, totalPower);

    const tier = data.rewardTier ?? 1;
    renderer.drawText({
      text: `POWER: ${displayPower(totalPower)}`,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2 - 30,
      font: BONUSTIME_TIMER_FONT,
      color: "#ffbe4d",
      align: "center",
      baseline: "middle"
    });

    renderer.drawText({
      text: `${getTierRarity(tier).toUpperCase()}`,
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2 + 10,
      font: BONUSTIME_BODY_FONT,
      color: getTierColor(tier),
      align: "center",
      baseline: "middle"
    });

    if (data.bellHit) {
      const extraTier = data.bellExtraTier ?? 7;
      renderer.drawText({
        text: `+ ${getTierRarity(extraTier).toUpperCase()} BELL BONUS`,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2 + 40,
        font: BONUSTIME_BODY_FONT,
        color: getTierColor(extraTier),
        align: "center",
        baseline: "middle"
      });
    }
  }
}

function renderWelcomeCard(
  data: HammerSmashData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 500,
    cardHeight: 330,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  renderBonusTimeWelcomeCard(renderer, rect, {
    cardWidth: 500,
    cardHeight: 330,
    title: "HAMMER SMASH",
    bodyLines: [
      "Smash the striker three times!",
      "Reach the top to ring the bell!"
    ],
    streakText: `Current Streak: ${data.streak}`,
    buttonText: "PLAY",
    titleColor: "#ff5b8f",
    bodyColor: "#edf2f7",
    streakColor: "#52df87",
    accentColor: "#ff5b8f",
    backgroundColor: "#120d24",
    glowColor: [255, 91, 143, 255],
    buttonActive: isPointInBonusTimeWelcomeButton(pointer, welcomeLayout)
  });
}

function renderTower(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  top: number,
  width: number,
  height: number
) {
  // Tower background
  renderer.drawRect({
    x,
    y: top,
    width,
    height,
    color: hexToRgba("#1a1a2e", 0.95)
  });

  // Tier segments
  const segmentBounds = [0, ...TIER_THRESHOLDS, BELL_THRESHOLD];
  for (let i = 0; i < segmentBounds.length - 1; i++) {
    const segStart = segmentBounds[i];
    const segEnd = segmentBounds[i + 1];
    const tier = i + 1;
    const yBottom = top + height - (segStart / BELL_THRESHOLD) * height;
    const yTop = top + height - (segEnd / BELL_THRESHOLD) * height;
    const segHeight = yBottom - yTop;

    renderer.drawRect({
      x: x + 2,
      y: yTop,
      width: width - 4,
      height: Math.max(1, segHeight),
      color: hexToRgba(getTierColor(Math.min(tier, 7)), 0.25)
    });
  }

  // Bell at top
  renderer.drawCircle(
    x + width / 2,
    top + 8,
    12,
    hexToRgba("#ffbe4d", 0.9),
    0.5
  );

  // Tower border
  renderer.drawRect({ x, y: top, width, height: 2, color: hexToRgba("#4a5568", 0.6) });
  renderer.drawRect({ x, y: top + height - 2, width, height: 2, color: hexToRgba("#4a5568", 0.6) });
  renderer.drawRect({ x, y: top, width: 2, height, color: hexToRgba("#4a5568", 0.4) });
  renderer.drawRect({ x: x + width - 2, y: top, width: 2, height, color: hexToRgba("#4a5568", 0.4) });
}

function renderPowerBar(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  rect: { x: number; y: number; width: number; height: number },
  fillPercent: number
) {
  const barWidth = Math.min(rect.width - 200, 400);
  const barHeight = 28;
  const barX = rect.x + (rect.width - barWidth) / 2 - 40;
  const barY = rect.y + rect.height - 140;

  // Bar background
  renderer.drawRect({
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight,
    color: hexToRgba("#1a1a2e", 0.9)
  });

  const fillWidth = Math.max(0, Math.min(barWidth - 4, (barWidth - 4) * fillPercent));
  const fillColor = fillPercent > 0.8 ? "#ff5b8f" : fillPercent > 0.5 ? "#ffbe4d" : "#52df87";

  renderer.drawRect({
    x: barX + 2,
    y: barY + 2,
    width: fillWidth,
    height: barHeight - 4,
    color: hexToRgba(fillColor, 0.9)
  });

  // Power label
  renderer.drawText({
    text: `${Math.round(fillPercent * 100)}%`,
    x: barX + barWidth / 2,
    y: barY + barHeight / 2,
    font: BONUSTIME_BODY_FONT,
    color: "#ffffff",
    align: "center",
    baseline: "middle"
  });
}

function renderPoleMarker(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  towerX: number,
  towerTop: number,
  towerWidth: number,
  towerHeight: number,
  currentPower: number
) {
  const fraction = Math.min(1, currentPower / BELL_THRESHOLD);
  const markerY = towerTop + towerHeight - (fraction * towerHeight);
  const cx = towerX + towerWidth / 2;

  // Pole fill from bottom to marker
  renderer.drawRect({
    x: towerX + towerWidth / 2 - 4,
    y: markerY,
    width: 8,
    height: towerTop + towerHeight - markerY,
    color: hexToRgba("#ff5b8f", 0.85)
  });

  // Marker ball
  renderer.drawCircle(cx, markerY, 10, hexToRgba("#ff5b8f", 1), 1);
  renderer.drawCircle(cx, markerY, 5, hexToRgba("#ffffff", 0.9), 1);

  // Display power text near marker
  renderer.drawText({
    text: `${displayPower(currentPower)}`,
    x: towerX - 20,
    y: markerY,
    font: BONUSTIME_BODY_FONT,
    color: "#edf2f7",
    align: "right",
    baseline: "middle"
  });
}

function renderBellHitEffect(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  cx: number,
  cy: number,
  progress: number
) {
  // Expanding glow rings
  const ringCount = 3;
  for (let i = 0; i < ringCount; i++) {
    const ringProgress = Math.min(1, progress * 2 - (i * 0.2));
    if (ringProgress <= 0) continue;
    const radius = 20 + ringProgress * 60 * (1 + i * 0.5);
    const alpha = Math.max(0, 0.6 - ringProgress * 0.6);
    renderer.drawCircle(cx, cy, radius, hexToRgba("#ffbe4d", alpha), alpha);
  }

  // Central flash
  if (progress < 0.3) {
    const flashAlpha = 1 - progress / 0.3;
    renderer.drawCircle(cx, cy, 30, hexToRgba("#ffffff", flashAlpha * 0.8), flashAlpha);
  }
}

function getSmashPhaseIndex(state: HammerSmashState): number {
  switch (state) {
    case HammerSmashState.SMASH_1: return 0;
    case HammerSmashState.SMASH_2: return 1;
    case HammerSmashState.SMASH_3: return 2;
    default: return 2;
  }
}

function getSmashPower(smashes: NonNullable<HammerSmashData["smashes"]>, phaseIndex: number): number {
  switch (phaseIndex) {
    case 0: return smashes.smash_1_power;
    case 1: return smashes.smash_2_power;
    case 2: return smashes.smash_3_power;
    default: return smashes.smash_3_power;
  }
}

function getCumulativePower(
  smashes: NonNullable<HammerSmashData["smashes"]>,
  currentPhase: number
): number {
  let total = 0;
  if (currentPhase > 0) total += smashes.smash_1_power;
  if (currentPhase > 1) total += smashes.smash_2_power;
  return total;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}
