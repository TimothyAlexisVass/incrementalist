import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, to255 } from "../../../utils";
import { getRewardTierLabelColor } from "../../../colors";
import { RewardLabyrinthData } from "./view-model";
import {
  LabyrinthState, getLabyrinthState, getCurrentCoords, getStepsRemaining,
  getDiscoveredChests, getHoveredDirection, getSymmetricConnections, getMazeSeed, getVisitedRooms
} from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { pluralize } from "../../../utils/format";
import {
  BONUSTIME_TITLE_FONT, BONUSTIME_TIMER_FONT, BONUSTIME_BODY_FONT
} from "../../../config";
import { renderBonusTimeWelcomeCard } from "../flow";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
}

function drawTierRewardTile(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  options: {
    x: number;
    y: number;
    size: number;
    tier: number;
    alpha?: number;
    fillAlpha?: number;
    borderThickness?: number;
    glow?: boolean;
    font?: string;
  }
) {
  const {
    x,
    y,
    size,
    tier,
    alpha = 1,
    fillAlpha = 0.15,
    borderThickness = 2,
    glow = false,
    font = `bold ${Math.max(9, Math.round(size * 0.34))}px Arial`
  } = options;
  const tierColor = getTierConfig(tier)?.color || "#FFFFFF";
  const stroke = Math.max(1, borderThickness);

  if (glow) {
    renderer.drawGlowRect({
      x,
      y,
      width: size,
      height: size,
      color: to255(hexToRgba(tierColor)),
      radius: Math.max(4, Math.round(size * 0.14)),
      intensity: 0.45,
      outerAlpha: 0.25,
      alpha
    });
  }

  renderer.drawRect({
    x,
    y,
    width: size,
    height: size,
    color: hexToRgba(tierColor, fillAlpha),
    alpha
  });

  renderer.drawRect({ x, y, width: size, height: stroke, color: hexToRgba(tierColor, 0.9), alpha });
  renderer.drawRect({ x, y: y + size - stroke, width: size, height: stroke, color: hexToRgba(tierColor, 0.9), alpha });
  renderer.drawRect({ x, y, width: stroke, height: size, color: hexToRgba(tierColor, 0.9), alpha });
  renderer.drawRect({ x: x + size - stroke, y, width: stroke, height: size, color: hexToRgba(tierColor, 0.9), alpha });

  renderer.drawText({
    text: `T${tier}`,
    x: x + size / 2,
    y: y + size / 2,
    font,
    color: getRewardTierLabelColor(tier),
    align: "center",
    baseline: "middle",
    alpha
  });
}

function getMaxRewardLabyrinthChestSlots() {
  const rules = bonusTimeConfig.game_rules.reward_labyrinth as {
    step_budget: {
      base_max: number;
      streak_scaling: {
        max_bonus: number;
      };
    };
    chest_count: {
      base_max: number;
      step_divisor: number;
    };
  };

  const maxSteps = rules.step_budget.base_max + rules.step_budget.streak_scaling.max_bonus;
  return rules.chest_count.base_max + Math.floor(maxSteps / rules.chest_count.step_divisor);
}

export function renderRewardLabyrinth(
  data: RewardLabyrinthData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const now = performance.now();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const state = getLabyrinthState();

  // 1. Render IDLE welcome view
  if (state === LabyrinthState.IDLE || state === LabyrinthState.PREPARING) {
    const isPreparing = state === LabyrinthState.PREPARING;
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 560,
      cardHeight: 360,
      title: "REWARD LABYRINTH",
      bodyLines: isPreparing
        ? ["Preparing your maze run..."]
        : ["Navigate a hidden maze of rewards."],
      streakText: `Current Streak: ${data.streak} ${pluralize(data.streak, "day")}`,
      buttonText: isPreparing ? "ENTERING..." : "ENTER LABYRINTH",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: "#ffbe4d",
      glowColor: [255, 190, 77, 255],
      backgroundColor: "#120d24",
      buttonActive: !isPreparing && getHoveredDirection() === "enter"
    });
    return;
  }

  // 2. Main PLAYING exploration view
  else if (state === LabyrinthState.PLAYING) {
    const coords = getCurrentCoords();
    const steps = getStepsRemaining();
    const seed = getMazeSeed();
    const connections = getSymmetricConnections(coords.x, coords.y, seed);

    // Deep panel background
    renderer.drawRect({
      x: rect.x + 20, y: rect.y + 20, width: rect.width - 40, height: rect.height - 40,
      color: hexToRgba("#121620", 0.95)
    });

    // Inner panel grid decoration
    renderer.drawGlowRect({
      x: rect.x + 20,
      y: rect.y + 20,
      width: rect.width - 40,
      height: rect.height - 40,
      color: to255(hexToRgba("#4A5568")),
      intensity: 0.15,
      radius: 10,
      innerAlpha: 0.05,
      outerAlpha: 0.15
    });

    // HUD Header
    renderer.drawText({
      text: "REWARD LABYRINTH",
      x: rect.x + 50, y: rect.y + 55, font: BONUSTIME_TITLE_FONT,
      color: "#E2E8F0", align: 'left', baseline: 'middle'
    });

    // Steps remaining with simple progress bar
    renderer.drawText({
      text: `STEPS REMAINING: ${steps}`,
      x: rect.x + rect.width - 50, y: rect.y + 55, font: BONUSTIME_TIMER_FONT,
      color: steps <= 3 ? "#FC8181" : "#4FD1C5", align: 'right', baseline: 'middle'
    });

    const barWidth = 180;
    const barX = rect.x + rect.width - 50 - barWidth;
    const barY = rect.y + 75;
    renderer.drawRect({
      x: barX, y: barY, width: barWidth, height: 6,
      color: hexToRgba("#2D3748", 1)
    });
    if (data.lastResult) {
      const pct = Math.max(0, Math.min(1, steps / data.lastResult.steps_total));
      renderer.drawRect({
        x: barX, y: barY, width: barWidth * pct, height: 6,
        color: steps <= 3 ? hexToRgba("#E53E3E", 1) : hexToRgba("#319795", 1)
      });
    }

    // 2D ROGUELIKE MAP GRID RENDERING
    // Centered around the player's active position, displaying visited rooms, unvisited paths, and chests
    const cellPitch = 56;
    const mapCenterY = centerY - 20;

    // 1. Draw physical maze corridors symmetrically
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const ax = coords.x + dx;
        const ay = coords.y + dy;
        const cellX = centerX + dx * cellPitch;
        const cellY = mapCenterY + dy * cellPitch;

        const cellConn = getSymmetricConnections(ax, ay, seed);

        // East Corridor
        if (dx < 4 && cellConn.east) {
          const isTraversed = getVisitedRooms().has(`${ax},${ay}`) && getVisitedRooms().has(`${ax + 1},${ay}`);
          renderer.drawRect({
            x: cellX + 20, y: cellY - 4, width: 16, height: 8,
            color: isTraversed ? hexToRgba("#4FD1C5", 0.5) : hexToRgba("#2D3748", 0.25)
          });
        }

        // South Corridor
        if (dy < 2 && cellConn.south) {
          const isTraversed = getVisitedRooms().has(`${ax},${ay}`) && getVisitedRooms().has(`${ax},${ay + 1}`);
          renderer.drawRect({
            x: cellX - 4, y: cellY + 20, width: 8, height: 16,
            color: isTraversed ? hexToRgba("#4FD1C5", 0.5) : hexToRgba("#2D3748", 0.25)
          });
        }
      }
    }

    // 2. Render all visible room grid boxes
    for (let dx = -4; dx <= 4; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const ax = coords.x + dx;
        const ay = coords.y + dy;
        const cellX = centerX + dx * cellPitch;
        const cellY = mapCenterY + dy * cellPitch;

        const isVisited = getVisitedRooms().has(`${ax},${ay}`);
        const isPlayer = dx === 0 && dy === 0;

        const isNorthWalkable = connections.north && (steps > 0 || getVisitedRooms().has(`${coords.x},${coords.y - 1}`));
        const isSouthWalkable = connections.south && (steps > 0 || getVisitedRooms().has(`${coords.x},${coords.y + 1}`));
        const isEastWalkable = connections.east && (steps > 0 || getVisitedRooms().has(`${coords.x + 1},${coords.y}`));
        const isWestWalkable = connections.west && (steps > 0 || getVisitedRooms().has(`${coords.x - 1},${coords.y}`));

        const isNorthOption = dx === 0 && dy === -1 && isNorthWalkable;
        const isSouthOption = dx === 0 && dy === 1 && isSouthWalkable;
        const isEastOption = dx === 1 && dy === 0 && isEastWalkable;
        const isWestOption = dx === -1 && dy === 0 && isWestWalkable;
        const isOption = isNorthOption || isSouthOption || isEastOption || isWestOption;

        if (isPlayer) {
          // Pulse halo outline
          renderer.drawGlowRect({
            x: cellX - 20,
            y: cellY - 20,
            width: 40,
            height: 40,
            color: to255(hexToRgba("#4FD1C5")),
            intensity: 0.35,
            radius: 6
          });
          // Solid player room box
          renderer.drawRect({
            x: cellX - 20, y: cellY - 20, width: 40, height: 40,
            color: hexToRgba("#1A202C", 1)
          });
          // Pulsing central beacon
          const pulseFactor = 1 + Math.sin(now * 0.005) * 0.15;
          renderer.drawCircle(cellX, cellY, 14 * pulseFactor, hexToRgba("#4FD1C5", 0.15));
          renderer.drawCircle(cellX, cellY, 6, hexToRgba("#4FD1C5", 1));

          // Draw "YOU" label inside
          renderer.drawText({
            text: "YOU",
            x: cellX, y: cellY + 12, font: BONUSTIME_BODY_FONT,
            color: "#4FD1C5", align: 'center', baseline: 'middle'
          });
        }
        else if (isVisited) {
          // Illumined visited room
          renderer.drawRect({
            x: cellX - 20, y: cellY - 20, width: 40, height: 40,
            color: hexToRgba("#1E2D3D", 0.9)
          });
          // Draw neat dim teal borders
          renderer.drawRect({ x: cellX - 20, y: cellY - 20, width: 40, height: 1.5, color: hexToRgba("#4FD1C5", 0.25) });
          renderer.drawRect({ x: cellX - 20, y: cellY + 18.5, width: 40, height: 1.5, color: hexToRgba("#4FD1C5", 0.25) });
          renderer.drawRect({ x: cellX - 20, y: cellY - 20, width: 1.5, height: 40, color: hexToRgba("#4FD1C5", 0.25) });
          renderer.drawRect({ x: cellX + 18.5, y: cellY - 20, width: 1.5, height: 40, color: hexToRgba("#4FD1C5", 0.25) });

          // Render small discovered chest indicator inside room cell if chest was found here
          const chest = getDiscoveredChests().find(c => c.x === ax && c.y === ay);
          if (chest) {
            const miniTileSize = 18;
            drawTierRewardTile(renderer, {
              x: cellX - miniTileSize / 2,
              y: cellY - miniTileSize / 2,
              size: miniTileSize,
              tier: chest.tier,
              fillAlpha: 0.3 + (Math.sin(now * 0.007) * 0.08),
              borderThickness: 1.5,
              glow: true,
              font: "bold 10px Arial"
            });
          } else {
            // Empty explored room center dot
            renderer.drawCircle(cellX, cellY, 3, hexToRgba("#4FD1C5", 0.3));
          }
        }
        else if (isOption) {
          const isHovered = pointer &&
            pointer.x >= cellX - 20 && pointer.x <= cellX + 20 &&
            pointer.y >= cellY - 20 && pointer.y <= cellY + 20;

          // Glowing gold/teal border for active walkable selections
          renderer.drawGlowRect({
            x: cellX - 20,
            y: cellY - 20,
            width: 40,
            height: 40,
            color: to255(hexToRgba(isHovered ? "#4FD1C5" : "#D69E2E")),
            intensity: isHovered ? 0.3 : 0.18,
            radius: 6
          });
          renderer.drawRect({
            x: cellX - 20, y: cellY - 20, width: 40, height: 40,
            color: hexToRgba(isHovered ? "#2D3748" : "#1A202C", 1)
          });

          // Direction arrow inside options
          let arrowChar = "";
          if (isNorthOption) arrowChar = "▲";
          else if (isSouthOption) arrowChar = "▼";
          else if (isEastOption) arrowChar = "▶";
          else if (isWestOption) arrowChar = "◀";

          renderer.drawText({
            text: arrowChar,
            x: cellX, y: cellY, font: BONUSTIME_BODY_FONT,
            color: isHovered ? "#4FD1C5" : "#D69E2E", align: 'center', baseline: 'middle'
          });
        }
        else {
          // Dim placeholder dots inside fog of war grid area
          renderer.drawCircle(cellX, cellY, 1.5, hexToRgba("#2D3748", 0.35));
        }
      }
    }

    // BOTTOM DISCOVERED CHEST SLOT ROW
    const chests = getDiscoveredChests();
    const inventoryY = rect.y + rect.height - 85;
    const maxSlots = getMaxRewardLabyrinthChestSlots();
    const slotSize = 52;
    const slotGap = 15;
    const rowWidth = maxSlots * slotSize + (maxSlots - 1) * slotGap;
    const startSlotX = centerX - rowWidth / 2;

    renderer.drawText({
      text: "CHESTS DISCOVERED",
      x: centerX, y: inventoryY - 30, font: BONUSTIME_BODY_FONT,
      color: "#718096", align: 'center', baseline: 'middle'
    });

    for (let i = 0; i < maxSlots; i++) {
      const slotX = startSlotX + i * (slotSize + slotGap);
      const chestFound = chests[i];

      if (chestFound) {
        // Found chest slot background and tier tile
        renderer.drawRect({
          x: slotX, y: inventoryY, width: slotSize, height: slotSize,
          color: hexToRgba("#1A202C", 1)
        });
        drawTierRewardTile(renderer, {
          x: slotX + 6,
          y: inventoryY + 6,
          size: slotSize - 12,
          tier: chestFound.tier,
          fillAlpha: 0.22 + (Math.sin(now * 0.007) * 0.05),
          borderThickness: 2,
          glow: true,
          font: "bold 14px Arial"
        });
      } else {
        // Empty slot dashed/dim circle
        renderer.drawRect({
          x: slotX, y: inventoryY, width: slotSize, height: slotSize,
          color: hexToRgba("#121620", 0.4)
        });
        renderer.drawRing(slotX + slotSize / 2, inventoryY + slotSize / 2, slotSize / 2 - 2, 1, hexToRgba("#2D3748", 0.6));
        renderer.drawText({
          text: "?",
          x: slotX + slotSize / 2, y: inventoryY + slotSize / 2, font: BONUSTIME_BODY_FONT,
          color: "#4A5568", align: 'center', baseline: 'middle'
        });
      }
    }

  }

  // 3. FINISHED STATE
  else if (state === LabyrinthState.FINISHED) {
    const cardWidth = 540;
    const cardHeight = 360;
    const cardRect = {
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2 - 20,
      width: cardWidth,
      height: cardHeight
    };

    // Deep panel background
    renderer.drawGlowRect({
      x: cardRect.x,
      y: cardRect.y,
      width: cardRect.width,
      height: cardRect.height,
      color: to255(hexToRgba("#D69E2E")), // Glowing Gold border
      intensity: 0.3,
      radius: 18,
      innerAlpha: 0.1,
      outerAlpha: 0.3
    });
    renderer.drawRect({
      x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height,
      color: hexToRgba("#1A202C", 0.95)
    });

    renderer.drawText({
      text: "LABYRINTH DONE!",
      x: centerX, y: cardRect.y + 60, font: BONUSTIME_TITLE_FONT,
      color: "#D69E2E", align: 'center', baseline: 'middle'
    });

    const chests = data.lastResult?.chests ?? [];

    renderer.drawText({
      text: `You found these items:`,
      x: centerX, y: cardRect.y + 160, font: BONUSTIME_BODY_FONT,
      color: "#E2E8F0", align: 'center', baseline: 'middle'
    });

    // Row of discovered chests inside results panel
    const rowY = cardRect.y + 180;
    const slotSize = 48;
    const slotGap = 12;
    const totalRowWidth = chests.length * slotSize + (chests.length - 1) * slotGap;
    const startX = centerX - totalRowWidth / 2;

    for (let i = 0; i < chests.length; i++) {
      const ch = chests[i];
      const slotX = startX + i * (slotSize + slotGap);

      renderer.drawRect({
        x: slotX, y: rowY, width: slotSize, height: slotSize,
        color: hexToRgba("#2D3748", 0.6)
      });
      drawTierRewardTile(renderer, {
        x: slotX + 5,
        y: rowY + 5,
        size: slotSize - 10,
        tier: ch.tier,
        fillAlpha: 0.2,
        borderThickness: 2,
        glow: true,
        font: "bold 13px Arial"
      });
    }
  }
}
