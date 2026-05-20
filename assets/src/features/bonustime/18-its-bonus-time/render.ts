import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, to255 } from "../../../utils";
import { getRewardTierLabelColor } from "../../../colors";
import { ItsBonusTimeData } from "./view-model";
import {
  ItsBonusTimeState, getItsBonusTimeState, getFlippedIndices, getRestFlippedIndices,
  getRevealIndexMap, getItsHoveredIndex, getFinalRevealStartTime
} from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import {
  BONUSTIME_TITLE_FONT, BONUSTIME_TIMER_FONT
} from "../../../config";
import { pluralize } from "../../../utils/format";
import { BONUSTIME_REWARD_MODAL_DELAY_MS, renderBonusTimeWelcomeCard } from "../flow";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

export function renderItsBonusTime(
  data: ItsBonusTimeData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const now = performance.now();
  const state = getItsBonusTimeState();

  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  if (state === ItsBonusTimeState.IDLE) {
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 600,
      cardHeight: 360,
      title: "IT'S BONUS TIME!",
      bodyLines: [
        "A massive hidden grid of rewards.",
        "Flip the tiles using your picks to reveal massive coin multipliers."
      ],
      streakText: `Current Streak: ${data.streak} ${pluralize(data.streak, "day")}`,
      buttonText: "FLIP THE BOARD",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: "#ffbe4d",
      glowColor: [122, 90, 240, 255],
      backgroundColor: "#1a1438",
      buttonActive: !!(pointer &&
        pointer.x >= centerX - 120 && pointer.x <= centerX + 120 &&
        pointer.y >= centerY + 70 && pointer.y <= centerY + 120)
    });

    return;
  }

  // Loading indicator if play was sent but precomputed board hasn't arrived
  if (!data.lastResult) {
    renderer.drawText({
      text: "GENERATING REWARD BOARD...",
      x: centerX, y: centerY, font: BONUSTIME_TITLE_FONT,
      color: "#edf2f7", align: 'center', baseline: 'middle'
    });
    return;
  }

  const flips = data.lastResult.flips;
  const flippedIndices = getFlippedIndices();
  const restFlippedIndices = getRestFlippedIndices();
  const revealMap = getRevealIndexMap();
  const hoveredIdx = getItsHoveredIndex();

  const picksMade = Math.min(flips, Array.from(flippedIndices).filter(idx => revealMap.has(idx)).length);
  const picksLeft = Math.max(0, flips - picksMade);

  // Status indicators at the top of display area
  renderer.drawText({
    text: "IT'S BONUS TIME!",
    x: rect.x + 40, y: rect.y + 40, font: BONUSTIME_TITLE_FONT,
    color: "#ffbe4d", align: 'left', baseline: 'middle'
  });

  // Single line Picks Text replacement:
  const picksText = picksLeft > 0
    ? `Flip ${picksLeft} ${picksLeft === flips ? '' : 'more '}${pluralize(picksLeft, 'tile')}`
    : '';
  renderer.drawText({
    text: picksText,
    x: rect.x + rect.width - 40, y: rect.y + 40, font: BONUSTIME_TIMER_FONT,
    color: picksLeft > 0 ? "#52df87" : "#ff5b8f", align: 'right', baseline: 'middle'
  });

  // 16x8 Grid rendering (Exactly 128 positions, no positions skipped)
  const cols = 16;
  const rows = 8;
  const tileSize = 55;
  const gap = 4;
  const totalGridWidth = cols * tileSize + (cols - 1) * gap;
  const totalGridHeight = rows * tileSize + (rows - 1) * gap;

  const gridStartX = rect.x + (rect.width - totalGridWidth) / 2;
  const gridStartY = rect.y + 110;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;

      const tx = gridStartX + c * (tileSize + gap);
      const ty = gridStartY + r * (tileSize + gap);

      const isPlayerFlipped = flippedIndices.has(idx);
      const isRestFlipped = restFlippedIndices.has(idx);

      if (isPlayerFlipped || isRestFlipped) {
        // Render REVEALED state for tile
        const tier = revealMap.get(idx) || 1;
        const tierConf = getTierConfig(tier);
        const tierColor = tierConf?.color || "#ffffff";

        // Wish 3: distinctly fade the rest of the tiles (opacity = 0.4)
        const alpha = isRestFlipped ? 0.4 : 1.0;

        // Soft outer glow of reward color
        renderer.drawGlowRect({
          x: tx, y: ty, width: tileSize, height: tileSize,
          color: to255(hexToRgba(tierColor)), radius: 8, intensity: 0.55, outerAlpha: 0.35, alpha
        });

        // Draw solid background block
        renderer.drawRect({
          x: tx, y: ty, width: tileSize, height: tileSize,
          color: hexToRgba(tierColor, 0.15), alpha
        });

        // Wish 4: Outline player picked ones with a thicker border
        if (isPlayerFlipped) {
          const borderThickness = 3;
          renderer.drawRect({ x: tx, y: ty, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 1.0) });
          renderer.drawRect({ x: tx, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 1.0) });
          renderer.drawRect({ x: tx + tileSize - borderThickness, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 1.0) });
          renderer.drawRect({ x: tx, y: ty + tileSize - borderThickness, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 1.0) });
        } else {
          // System unclicked reveals draw thin, faded border
          const borderThickness = 1.5;
          renderer.drawRect({ x: tx, y: ty, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 0.8), alpha });
          renderer.drawRect({ x: tx, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 0.8), alpha });
          renderer.drawRect({ x: tx + tileSize - borderThickness, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 0.8), alpha });
          renderer.drawRect({ x: tx, y: ty + tileSize - borderThickness, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 0.8), alpha });
        }

        // Tier text inside
        renderer.drawText({
          text: `T${tier}`,
          x: tx + tileSize / 2, y: ty + tileSize / 2,
          font: "bold 20px 'Outfit'", color: getRewardTierLabelColor(tier), align: 'center', baseline: 'middle', alpha
        });
      } else {
        // Render CLOSED state for tile
        const isHovered = hoveredIdx === idx;
        const scale = isHovered ? 1.04 : 1.0;
        const drawSize = tileSize * scale;
        const offset = (drawSize - tileSize) / 2;

        if (isHovered) {
          renderer.drawGlowRect({
            x: tx - offset, y: ty - offset, width: drawSize, height: drawSize,
            color: [255, 190, 77, 255], radius: 10, intensity: 0.45, outerAlpha: 0.25
          });
        }

        // Closed card background
        renderer.drawGradientRect({
          x: tx - offset, y: ty - offset, width: drawSize, height: drawSize,
          colorStart: hexToRgba("#2a1f4d"),
          colorEnd: hexToRgba("#181230")
        });

        // Closed border
        const borderColor = isHovered ? "#ffbe4d" : "#4a3c75";
        renderer.drawRect({ x: tx - offset, y: ty - offset, width: drawSize, height: 1.5, color: hexToRgba(borderColor, 0.8) });
        renderer.drawRect({ x: tx - offset, y: ty - offset, width: 1.5, height: drawSize, color: hexToRgba(borderColor, 0.8) });
        renderer.drawRect({ x: tx - offset + drawSize - 1.5, y: ty - offset, width: 1.5, height: drawSize, color: hexToRgba(borderColor, 0.8) });
        renderer.drawRect({ x: tx - offset, y: ty - offset + drawSize - 1.5, width: drawSize, height: 1.5, color: hexToRgba(borderColor, 0.8) });

        // Glowing Question Mark "?" inside
        renderer.drawText({
          text: "?",
          x: tx + tileSize / 2, y: ty + tileSize / 2,
          font: isHovered ? "bold 19px Arial" : "17px Arial",
          color: isHovered ? "#ffbe4d" : "#7b6fa3",
          align: 'center', baseline: 'middle'
        });
      }
    }
  }

  // 3. Render final countdown overlay if in FINAL_REVEAL state
  if (state === ItsBonusTimeState.FINAL_REVEAL) {
    const elapsed = now - getFinalRevealStartTime();
    const remainingIndicesCount = 128 - flips;
    const allRevealedDuration = 2000 + remainingIndicesCount * 20;

    const remainingMs = Math.max(0, (allRevealedDuration + BONUSTIME_REWARD_MODAL_DELAY_MS) - elapsed);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    const bannerWidth = 460;
    const bannerHeight = 80;
    const bannerX = centerX - bannerWidth / 2;
    const bannerY = gridStartY + totalGridHeight + 10;

    renderer.drawGlowRect({
      x: bannerX, y: bannerY, width: bannerWidth, height: bannerHeight,
      color: [82, 223, 135, 255], radius: 12, intensity: 0.45, outerAlpha: 0.25
    });

    renderer.drawRect({
      x: bannerX, y: bannerY, width: bannerWidth, height: bannerHeight,
      color: hexToRgba("#0b1a13", 0.95)
    });

    renderer.drawRect({ x: bannerX, y: bannerY, width: bannerWidth, height: 2, color: hexToRgba("#52df87", 0.8) });
    renderer.drawRect({ x: bannerX, y: bannerY + bannerHeight - 2, width: bannerWidth, height: 2, color: hexToRgba("#52df87", 0.8) });

    renderer.drawText({
      text: "ALL REWARDS REVEALED!",
      x: centerX, y: bannerY + 28, font: "bold 15px Arial",
      color: "#52df87", align: 'center', baseline: 'middle'
    });

    renderer.drawText({
      text: `Collecting rewards in ${remainingSeconds}s...`,
      x: centerX, y: bannerY + 54, font: "13px Arial",
      color: "#a0aec0", align: 'center', baseline: 'middle'
    });
  }
}
