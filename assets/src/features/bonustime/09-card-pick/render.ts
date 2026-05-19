import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, to255 } from "../../../utils";
import { CardPickData } from "./view-model";
import {
  CardPickState, getCardPickState, getFlippedIndices, getRestFlippedIndices,
  getRevealIndexMap, getCardPickHoveredIndex, getFinalRevealStartTime,
  getCurrentMaxPicks, getBonusPhaseStartTime
} from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { drawButton } from "../../../ui/components/button";
import {
  BONUSTIME_TITLE_FONT, BONUSTIME_TIMER_FONT, MODAL_BODY_FONT, BONUSTIME_BUTTON_FONT,
  BONUSTIME_BODY_FONT
} from "../../../config";
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
    const cardWidth = 560;
    const cardHeight = 360;
    const cardRect = {
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2 - 20,
      width: cardWidth,
      height: cardHeight
    };

    // Modal panel background
    renderer.drawGlowRect({
      x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height,
      color: [255, 190, 77, 255], radius: 16, intensity: 0.3, outerAlpha: 0.15
    });

    renderer.drawRect({
      x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height,
      color: hexToRgba("#120d24", 0.98)
    });

    // Top and bottom accent lines
    renderer.drawRect({ x: cardRect.x, y: cardRect.y, width: cardRect.width, height: 3, color: hexToRgba("#ffbe4d", 0.8) });
    renderer.drawRect({ x: cardRect.x, y: cardRect.y + cardRect.height - 3, width: cardRect.width, height: 3, color: hexToRgba("#ffbe4d", 0.8) });

    // Title text
    renderer.drawText({
      text: "CARD PICK",
      x: centerX, y: cardRect.y + 60, font: BONUSTIME_TITLE_FONT,
      color: "#ffbe4d", align: 'center', baseline: 'middle'
    });

    // Subtitle / Description
    renderer.drawText({
      text: "Flip cards with a chance to win massive prizes",
      x: centerX, y: cardRect.y + 130, font: BONUSTIME_BODY_FONT,
      color: "#edf2f7", align: 'center', baseline: 'middle'
    });

    const initialPicks = 2 + Math.min(7, Math.floor(Math.max(0, data.streak) / 7));
    const dayLabel = pluralize(data.streak, "day");
    const pickLabel = pluralize(initialPicks, "pick");
    renderer.drawText({
      text: `Current Streak: ${data.streak} ${dayLabel}  (${initialPicks} starting ${pickLabel})`,
      x: centerX, y: cardRect.y + 195, font: BONUSTIME_BODY_FONT,
      color: "#52df87", align: 'center', baseline: 'middle'
    });

    // Play Button
    const btnRect = { x: centerX - 120, y: centerY + 70, width: 240, height: 50 };
    const isOverBtn = pointer &&
      pointer.x >= btnRect.x && pointer.x <= btnRect.x + btnRect.width &&
      pointer.y >= btnRect.y && pointer.y <= btnRect.y + btnRect.height;

    drawButton(btnRect, "START", {
      font: BONUSTIME_BUTTON_FONT,
      active: !!isOverBtn
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
    ? (getCurrentMaxPicks() || (2 + Math.min(7, Math.floor(Math.max(0, data.streak) / 7))))
    : (getCurrentMaxPicks() || flips);

  const picksMade = Math.min(currentMaxPicks, Array.from(flippedIndices).filter(idx => revealMap.has(idx)).length);
  const picksLeft = Math.max(0, currentMaxPicks - picksMade);

  // Status indicators at the top of display area
  renderer.drawText({
    text: "CARD PICK",
    x: rect.x + 40, y: rect.y + 40, font: BONUSTIME_TITLE_FONT,
    color: "#ffbe4d", align: 'left', baseline: 'middle'
  });

  const picksText = picksLeft > 0
    ? `Pick ${picksLeft} ${picksLeft === currentMaxPicks ? '' : 'more '}${pluralize(picksLeft, 'card')}`
    : '';
  renderer.drawText({
    text: picksText,
    x: rect.x + rect.width - 40, y: rect.y + 40, font: BONUSTIME_TIMER_FONT,
    color: picksLeft > 0 ? "#52df87" : "#ff5b8f", align: 'right', baseline: 'middle'
  });

  // 6x6 Grid rendering
  const cols = 6;
  const rows = 6;
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

        // Outer glow of reward color
        renderer.drawGlowRect({
          x: tx, y: ty, width: tileSize, height: tileSize,
          color: to255(hexToRgba(tierColor)), radius: 8, intensity: 0.55, outerAlpha: 0.35, alpha
        });

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
          font: "bold 22px 'Outfit'", color: tierColor, align: 'center', baseline: 'middle', alpha
        });
      } else {
        // Render CLOSED state for tile
        const isHovered = (state === CardPickState.PLAYING) && (hoveredIdx === idx);
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
          font: isHovered ? "bold 21px Arial" : "19px Arial",
          color: isHovered ? "#ffbe4d" : "#7b6fa3",
          align: 'center', baseline: 'middle'
        });
      }
    }
  }

  // 3. Render gorgeous gold bonus count down overlay if in BONUS_PENDING state
  if (state === CardPickState.BONUS_PENDING) {
    const elapsed = now - getBonusPhaseStartTime();
    const remainingMs = Math.max(0, 5000 - elapsed);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    const bannerWidth = 460;
    const bannerHeight = 80;
    const bannerX = centerX - bannerWidth / 2;
    const bannerY = gridStartY + totalGridHeight + 20;

    renderer.drawGlowRect({
      x: bannerX, y: bannerY, width: bannerWidth, height: bannerHeight,
      color: [255, 190, 77, 255], radius: 12, intensity: 0.45, outerAlpha: 0.25
    });

    renderer.drawRect({
      x: bannerX, y: bannerY, width: bannerWidth, height: bannerHeight,
      color: hexToRgba("#1c140a", 0.95)
    });

    renderer.drawRect({ x: bannerX, y: bannerY, width: bannerWidth, height: 2, color: hexToRgba("#ffbe4d", 0.8) });
    renderer.drawRect({ x: bannerX, y: bannerY + bannerHeight - 2, width: bannerWidth, height: 2, color: hexToRgba("#ffbe4d", 0.8) });

    renderer.drawText({
      text: "YOU GOT A BONUS PICK!",
      x: centerX, y: bannerY + 28, font: "bold 15px Arial",
      color: "#ffbe4d", align: 'center', baseline: 'middle'
    });

    renderer.drawText({
      text: `Shuffling cards in ${remainingSeconds}s...`,
      x: centerX, y: bannerY + 54, font: "13px Arial",
      color: "#a0aec0", align: 'center', baseline: 'middle'
    });
  }

  // 4. Render final countdown overlay if in FINAL_REVEAL state
  if (state === CardPickState.FINAL_REVEAL) {
    const elapsed = now - getFinalRevealStartTime();
    const remainingIndicesCount = 36 - flips;
    const allRevealedDuration = 2000 + remainingIndicesCount * 30;

    const remainingMs = Math.max(0, (allRevealedDuration + 3000) - elapsed);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    const bannerWidth = 460;
    const bannerHeight = 80;
    const bannerX = centerX - bannerWidth / 2;
    const bannerY = gridStartY + totalGridHeight + 20;

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
