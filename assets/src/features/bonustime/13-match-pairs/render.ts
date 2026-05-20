import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, to255 } from "../../../utils";
import { getRewardTierLabelColor } from "../../../colors";
import { MatchPairsData } from "./view-model";
import {
  MatchPairsState, getMatchPairsState, getKnown, getMatched, getMatchPairsGridLayout,
  getFirstClickIndex, getSecondClickIndex, getHoveredIndex, isMatchAnim,
  getRestFlippedIndices
} from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { drawButton } from "../../../ui/components/button";
import {
  BONUSTIME_TITLE_FONT, BONUSTIME_BUTTON_FONT,
  BONUSTIME_BODY_FONT
} from "../../../config";
import { pluralize } from "../../../utils/format";

function getTierConfig(tier: string) {
  return (bonusTimeConfig.reward_tiers as any)[tier];
}

export function renderMatchPairs(
  data: MatchPairsData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const now = performance.now();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const state = getMatchPairsState();
  const { cols, rows, tileSize, gap, gridStartX, gridStartY, totalGridHeight } = getMatchPairsGridLayout(rect);

  // 1. Render IDLE welcome view
  if (state === MatchPairsState.IDLE) {
    const cardWidth = 560;
    const cardHeight = 360;
    const cardRect = {
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2 - 20,
      width: cardWidth,
      height: cardHeight
    };

    renderer.drawGlowRect({
      x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height,
      color: [82, 223, 135, 255], radius: 16, intensity: 0.3, outerAlpha: 0.15
    });

    renderer.drawRect({
      x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height,
      color: hexToRgba("#120d24", 0.98)
    });

    renderer.drawRect({ x: cardRect.x, y: cardRect.y, width: cardRect.width, height: 3, color: hexToRgba("#52df87", 0.8) });
    renderer.drawRect({ x: cardRect.x, y: cardRect.y + cardRect.height - 3, width: cardRect.width, height: 3, color: hexToRgba("#52df87", 0.8) });

    renderer.drawText({
      text: "MATCH PAIRS",
      x: centerX, y: cardRect.y + 60, font: BONUSTIME_TITLE_FONT,
      color: "#52df87", align: 'center', baseline: 'middle'
    });

    renderer.drawText({
      text: "Find matching symbols. Unmatched rewards will be discarded.",
      x: centerX, y: cardRect.y + 130, font: BONUSTIME_BODY_FONT,
      color: "#edf2f7", align: 'center', baseline: 'middle'
    });

    const dayLabel = pluralize(data.streak, "day");
    renderer.drawText({
      text: `Current Streak: ${data.streak} ${dayLabel}`,
      x: centerX, y: cardRect.y + 195, font: BONUSTIME_BODY_FONT,
      color: "#52df87", align: 'center', baseline: 'middle'
    });

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

  const known = getKnown();
  const matched = getMatched();
  const restFlippedIndices = getRestFlippedIndices();
  const firstClick = getFirstClickIndex();
  const secondClick = getSecondClickIndex();
  const hoveredIdx = getHoveredIndex();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const tx = gridStartX + c * (tileSize + gap);
      const ty = gridStartY + r * (tileSize + gap);

      const isFirst = idx === firstClick;
      const isSecond = idx === secondClick;
      const isMatched = matched.has(idx);
      const isRestFlipped = restFlippedIndices.has(idx);
      const isFlipped = isFirst || isSecond || isMatched || isRestFlipped || state === MatchPairsState.REVEALED;

      if (isFlipped && known.has(idx)) {
        const tier = known.get(idx)!;
        const tierConf = getTierConfig(tier);
        const tierColor = tierConf?.color || "#ffffff";
        
        // If matched or it's a match anim on these cards, give it a highlight
        const isCurrentlyMatching = isMatchAnim() && (isFirst || isSecond);
        const activeHighlight = isMatched || isCurrentlyMatching;

        const alpha = (state === MatchPairsState.FINAL_REVEAL || state === MatchPairsState.REVEALED) && !isMatched ? 0.35 : 1.0;

        renderer.drawGlowRect({
          x: tx, y: ty, width: tileSize, height: tileSize,
          color: to255(hexToRgba(tierColor)), radius: 8, intensity: activeHighlight ? 0.6 : 0.3, outerAlpha: activeHighlight ? 0.4 : 0.2, alpha
        });

        renderer.drawRect({
          x: tx, y: ty, width: tileSize, height: tileSize,
          color: hexToRgba(tierColor, activeHighlight ? 0.25 : 0.15), alpha
        });

        // Border
        const borderThickness = activeHighlight ? 3 : 1.5;
        const borderColor = hexToRgba(tierColor, activeHighlight ? 1.0 : 0.8);
        renderer.drawRect({ x: tx, y: ty, width: tileSize, height: borderThickness, color: borderColor, alpha });
        renderer.drawRect({ x: tx, y: ty, width: borderThickness, height: tileSize, color: borderColor, alpha });
        renderer.drawRect({ x: tx + tileSize - borderThickness, y: ty, width: borderThickness, height: tileSize, color: borderColor, alpha });
        renderer.drawRect({ x: tx, y: ty + tileSize - borderThickness, width: tileSize, height: borderThickness, color: borderColor, alpha });

        // Symbol
        const symbolText = tier.replace("tier_", "T");
        const symbolFontSize = Math.max(26, Math.round(tileSize * 0.35));
        renderer.drawText({
          text: symbolText,
          x: tx + tileSize / 2, y: ty + tileSize / 2,
          font: `bold ${symbolFontSize}px 'Outfit'`, color: getRewardTierLabelColor(tier), align: 'center', baseline: 'middle', alpha
        });

      } else {
        // Face down
        const isHovered = (state === MatchPairsState.PLAYING) && (hoveredIdx === idx) && !isMatched && idx !== firstClick;
        const scale = isHovered ? 1.04 : 1.0;
        const drawSize = tileSize * scale;
        const offset = (drawSize - tileSize) / 2;

        if (isHovered) {
          renderer.drawGlowRect({
            x: tx - offset, y: ty - offset, width: drawSize, height: drawSize,
            color: [82, 223, 135, 255], radius: 10, intensity: 0.45, outerAlpha: 0.25
          });
        }

        renderer.drawGradientRect({
          x: tx - offset, y: ty - offset, width: drawSize, height: drawSize,
          colorStart: hexToRgba("#1a2b20"),
          colorEnd: hexToRgba("#0c1510")
        });

        const borderColor = isHovered ? "#52df87" : "#2a4d36";
        renderer.drawRect({ x: tx - offset, y: ty - offset, width: drawSize, height: 1.5, color: hexToRgba(borderColor, 0.8) });
        renderer.drawRect({ x: tx - offset, y: ty - offset, width: 1.5, height: drawSize, color: hexToRgba(borderColor, 0.8) });
        renderer.drawRect({ x: tx - offset + drawSize - 1.5, y: ty - offset, width: 1.5, height: drawSize, color: hexToRgba(borderColor, 0.8) });
        renderer.drawRect({ x: tx - offset, y: ty - offset + drawSize - 1.5, width: drawSize, height: 1.5, color: hexToRgba(borderColor, 0.8) });
      }
    }
  }

  if (state === MatchPairsState.REVEALED) {
     renderer.drawText({
      text: "GAME OVER",
      x: centerX, y: centerY, font: BONUSTIME_TITLE_FONT,
      color: "#ffffff", align: 'center', baseline: 'middle'
    });
  }
}
