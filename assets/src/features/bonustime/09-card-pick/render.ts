import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import { getRewardTierLabelColor } from "../../../colors";
import { CardPickData } from "./view-model";
import {
  BONUSTIME_CARD_PICK_BOARD_SIZE,
  getCardPickInitialPicks,
  renderBonusTimeWelcomeCard
} from "../flow";
import {
  CardPickState, getCardPickState, getFlippedIndices, getRestFlippedIndices,
  getRevealIndexMap, getCardPickHoveredIndex, getCurrentMaxPicks, getBonusPhaseStartTime
} from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { BONUSTIME_TITLE_FONT } from "../../../config";
import { pluralize } from "../../../utils/format";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

export function renderCardPick(
  data: CardPickData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const now = performance.now();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const state = getCardPickState();

  // 1. Render IDLE welcome view
  if (state === CardPickState.IDLE) {
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 560,
      cardHeight: 360,
      title: "CARD PICK",
      bodyLines: ["Flip cards with a chance to win massive prizes"],
      streakText: (() => {
        const initialPicks = getCardPickInitialPicks(data.streak);
        const dayLabel = pluralize(data.streak, "day");
        const pickLabel = pluralize(initialPicks, "pick");
        return `Current Streak: ${data.streak} ${dayLabel}  (${initialPicks} starting ${pickLabel})`;
      })(),
      buttonText: "START",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: "#ffbe4d",
      glowColor: [255, 190, 77, 255],
      backgroundColor: "#120d24",
      buttonActive: !!(pointer &&
        pointer.x >= (centerX - 120) &&
        pointer.x <= (centerX + 120) &&
        pointer.y >= (centerY + 70) &&
        pointer.y <= (centerY + 120))
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
  const hoveredIdx = getCardPickHoveredIndex();

  const currentMaxPicks = (state === CardPickState.PLAYING)
    ? (getCurrentMaxPicks() || getCardPickInitialPicks(data.streak))
    : (getCurrentMaxPicks() || flips);

  // Status indicators at the top of display area
  renderer.drawText({
    text: "CARD PICK",
    x: rect.x + 40, y: rect.y + 40, font: BONUSTIME_TITLE_FONT,
    color: "#ffbe4d", align: 'left', baseline: 'middle'
  });

  // 6x6 Grid rendering
  const cols = Math.round(Math.sqrt(BONUSTIME_CARD_PICK_BOARD_SIZE));
  const rows = cols;
  const tileSize = 65;
  const gap = 10;
  const totalGridWidth = cols * tileSize + (cols - 1) * gap;
  const totalGridHeight = rows * tileSize + (rows - 1) * gap;

  const gridStartX = rect.x + (rect.width - totalGridWidth) / 2;
  const gridStartY = rect.y + 100;

  const gridCenterX = gridStartX + totalGridWidth / 2;
  const gridCenterY = gridStartY + totalGridHeight / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;

      let tx = gridStartX + c * (tileSize + gap);
      let ty = gridStartY + r * (tileSize + gap);

      // WebGL Shuffling Physics: Chaotic, deterministic random shuffle around center grid coordinates
      if (state === CardPickState.SHUFFLING) {
        const elapsed = now - getBonusPhaseStartTime();
        const t = Math.min(1.0, elapsed / 1500); // 0 to 1
        
        // Envelope goes from 0 -> 1 -> 0
        const env = Math.sin(t * Math.PI);

        // Unique frequency and phases based on card index to ensure chaotic paths
        const freqX = 12 + (idx % 5) * 4;
        const freqY = 10 + (idx % 7) * 3;
        const phaseX = (idx * 0.77) % Math.PI;
        const phaseY = (idx * 1.33) % Math.PI;

        // Base rotation and scale contraction
        const angle = env * Math.PI * (1.5 + (idx % 4) * 0.5);
        const scale = 1.0 - env * (0.35 + (idx % 3) * 0.05);

        // Chaotic displacement amplitude
        const wobbleAmp = 80 * env;
        const wobbleX = wobbleAmp * Math.sin(t * freqX + phaseX);
        const wobbleY = wobbleAmp * Math.cos(t * freqY + phaseY);

        const dx = tx - gridCenterX;
        const dy = ty - gridCenterY;

        const rotX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const rotY = dx * Math.sin(angle) + dy * Math.cos(angle);

        tx = gridCenterX + rotX * scale + wobbleX;
        ty = gridCenterY + rotY * scale + wobbleY;
      }

      const isPlayerFlipped = flippedIndices.has(idx);
      const isRestFlipped = restFlippedIndices.has(idx);

      // Cards turn completely upside down again (closed) during shuffling phase
      const isFlipped = (state !== CardPickState.SHUFFLING) && (isPlayerFlipped || isRestFlipped);

      if (isFlipped) {
        // Render REVEALED state for tile
        const cardVal = revealMap.get(idx) || { tier: 1, multiplier: 1 };
        const tier = cardVal.tier;
        const tierConf = getTierConfig(tier);
        const tierColor = tierConf?.color || "#ffffff";

        // Dim unclicked ones flipped in FINAL_REVEAL
        const alpha = isRestFlipped ? 0.35 : 1.0;



        // Draw solid background block
        renderer.drawRect({
          x: tx, y: ty, width: tileSize, height: tileSize,
          color: hexToRgba(tierColor, 0.15), alpha
        });

        // Outline player-picked ones with thicker border, missed ones with thin border
        if (isPlayerFlipped) {
          const borderThickness = 3;
          renderer.drawRect({ x: tx, y: ty, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 1.0) });
          renderer.drawRect({ x: tx, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 1.0) });
          renderer.drawRect({ x: tx + tileSize - borderThickness, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 1.0) });
          renderer.drawRect({ x: tx, y: ty + tileSize - borderThickness, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 1.0) });
        } else {
          const borderThickness = 1.5;
          renderer.drawRect({ x: tx, y: ty, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 0.8), alpha });
          renderer.drawRect({ x: tx, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 0.8), alpha });
          renderer.drawRect({ x: tx + tileSize - borderThickness, y: ty, width: borderThickness, height: tileSize, color: hexToRgba(tierColor, 0.8), alpha });
          renderer.drawRect({ x: tx, y: ty + tileSize - borderThickness, width: tileSize, height: borderThickness, color: hexToRgba(tierColor, 0.8), alpha });
        }

        // Tier text inside card
        renderer.drawText({
          text: `T${tier}`,
          x: tx + tileSize / 2, y: ty + tileSize / 2,
          font: "bold 22px 'Outfit'", color: getRewardTierLabelColor(tier), align: 'center', baseline: 'middle', alpha
        });
      } else {
        // Render CLOSED state for tile
        const isHovered = (state === CardPickState.PLAYING) && (hoveredIdx === idx);
        const scale = isHovered ? 1.04 : 1.0;
        const drawSize = tileSize * scale;
        const offset = (drawSize - tileSize) / 2;



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
          font: isHovered ? "bold 21px Arial" : "19px Arial",
          color: isHovered ? "#ffbe4d" : "#7b6fa3",
          align: 'center', baseline: 'middle'
        });
      }
    }
  }

}
