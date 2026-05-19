import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba, to255 } from "../../../utils";
import { RewardLabyrinthData } from "./view-model";
import {
  LabyrinthState, getLabyrinthState, getCurrentCoords, getStepsRemaining,
  getDiscoveredChests, getActiveChestOpening,
  getIncomingDir, getHoveredDirection, getSymmetricConnections, getMazeSeed, getVisitedRooms
} from "./interactions";
import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { drawButton } from "../../../ui/components/button";
import {
  BONUSTIME_TITLE_FONT, BONUSTIME_TIMER_FONT, BONUSTIME_BUTTON_FONT,
  BONUSTIME_BODY_FONT
} from "../../../config";

function getTierConfig(tier: number) {
  return (bonusTimeConfig.reward_tiers as any)[`tier_${tier}`];
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
  if (state === LabyrinthState.IDLE) {
    const cardWidth = 560;
    const cardHeight = 360;
    const cardRect = {
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2 - 20,
      width: cardWidth,
      height: cardHeight
    };

    // Deep glassmorphic outer panel
    renderer.drawGlowRect({
      x: cardRect.x,
      y: cardRect.y,
      width: cardRect.width,
      height: cardRect.height,
      color: to255(hexToRgba("#4FD1C5")), // glowing teal outline
      intensity: 0.35,
      radius: 20,
      innerAlpha: 0.1,
      outerAlpha: 0.4
    });
    renderer.drawRect({
      x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height,
      color: hexToRgba("#1A202C", 0.95)
    });

    // Decorative procedural maze border background lines
    for (let i = 0; i < 4; i++) {
      const lineOffset = 15 + i * 8;
      renderer.drawRect({
        x: cardRect.x + lineOffset, y: cardRect.y + lineOffset, width: cardRect.width - lineOffset * 2, height: 2,
        color: hexToRgba("#4FD1C5", 0.08)
      });
      renderer.drawRect({
        x: cardRect.x + lineOffset, y: cardRect.y + cardRect.height - lineOffset - 2, width: cardRect.width - lineOffset * 2, height: 2,
        color: hexToRgba("#4FD1C5", 0.08)
      });
    }

    renderer.drawText({
      text: "REWARD LABYRINTH",
      x: centerX, y: cardRect.y + 60, font: BONUSTIME_TITLE_FONT,
      color: "#E2E8F0", align: 'center', baseline: 'middle'
    });

    renderer.drawText({
      text: "Enter the labyrinth to discover hidden treasures",
      x: centerX, y: cardRect.y + 130, font: BONUSTIME_BODY_FONT,
      color: "#A0AEC0", align: 'center', baseline: 'middle'
    });

    if (data.streak >= 15) {
      renderer.drawText({
        text: `Your login streak of ${data.streak} grants bonus steps!`,
        x: centerX, y: cardRect.y + 175, font: BONUSTIME_BODY_FONT,
        color: "#4FD1C5", align: 'center', baseline: 'middle'
      });
    }

    // Enter button
    const btnRect = { x: centerX - 120, y: cardRect.y + 240, width: 240, height: 50 };
    const hovered = getHoveredDirection() === 'enter';
    drawButton(btnRect, "ENTER LABYRINTH", {
      font: BONUSTIME_BUTTON_FONT,
      active: hovered,
      activeSurface: "#319795",
      inactiveSurface: "#1A202C",
      activeBorder: "#4FD1C5",
      inactiveBorder: "#2D3748",
      textColor: "#ffffff"
    });
  }

  // 2. Main PLAYING exploration / CHEST_OPENING view
  else if (state === LabyrinthState.PLAYING || state === LabyrinthState.CHEST_OPENING) {
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
            const tierCfg = getTierConfig(chest.tier);
            const rColor = tierCfg ? tierCfg.color : "#FFFFFF";
            renderer.drawCircle(cellX, cellY, 8, hexToRgba(rColor, 0.35 + Math.sin(now * 0.007) * 0.1));
            renderer.drawText({
              text: `T${chest.tier}`,
              x: cellX, y: cellY, font: BONUSTIME_BODY_FONT,
              color: rColor, align: 'center', baseline: 'middle'
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
    const maxSlots = 5;
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
        const tierCfg = getTierConfig(chestFound.tier);
        const rColor = tierCfg ? tierCfg.color : "#FFFFFF";

        // Found chest slot background and gold ring border
        renderer.drawRect({
          x: slotX, y: inventoryY, width: slotSize, height: slotSize,
          color: hexToRgba("#1A202C", 1)
        });
        renderer.drawRing(slotX + slotSize / 2, inventoryY + slotSize / 2, slotSize / 2 - 2, 2, hexToRgba(rColor, 0.8));

        // Pulsing glowing center
        renderer.drawCircle(slotX + slotSize / 2, inventoryY + slotSize / 2, 10, hexToRgba(rColor, 0.35 + Math.sin(now * 0.007) * 0.1));
        renderer.drawText({
          text: `T${chestFound.tier}`,
          x: slotX + slotSize / 2, y: inventoryY + slotSize / 2, font: BONUSTIME_BODY_FONT,
          color: rColor, align: 'center', baseline: 'middle'
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

    // Finish Run button (draw only in playing state)
    if (state === LabyrinthState.PLAYING) {
      const finishBtn = { x: centerX - 80, y: centerY + 145, width: 160, height: 35 };
      const hovered = pointer &&
        pointer.x >= finishBtn.x && pointer.x <= finishBtn.x + finishBtn.width &&
        pointer.y >= finishBtn.y && pointer.y <= finishBtn.y + finishBtn.height;
      drawButton(finishBtn, "FINISH RUN", {
        font: BONUSTIME_BUTTON_FONT,
        active: !!hovered,
        activeSurface: "#E53E3E",
        inactiveSurface: "#1A202C",
        activeBorder: "#FC8181",
        inactiveBorder: "#2D3748",
        textColor: "#ffffff"
      });
    }

    // 3. CHEST OPENING CINEMATIC OVERLAY
    const opening = getActiveChestOpening();
    if (state === LabyrinthState.CHEST_OPENING && opening) {
      // Dim background
      renderer.drawRect({
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        color: hexToRgba("#0B0C10", 0.75)
      });

      const tierCfg = getTierConfig(opening.tier);
      const rColor = tierCfg ? tierCfg.color : "#FFFFFF";
      const elapsed = now - opening.startTime;

      // Smooth floating floating sine wave
      const floatY = centerY - 50 + Math.sin(now * 0.005) * 15;

      // Expand ring burst shockwaves
      if (elapsed < 1200) {
        const burstRadius = (elapsed / 1200) * 220;
        const burstAlpha = 1 - (elapsed / 1200);
        renderer.drawRing(centerX, floatY, burstRadius, 4, hexToRgba(rColor, burstAlpha), 0.1);
      }

      // Golden aura ray beams
      const auraPulse = 1.0 + Math.sin(now * 0.01) * 0.1;
      renderer.drawCircle(centerX, floatY, 80 * auraPulse, hexToRgba(rColor, 0.12));
      renderer.drawCircle(centerX, floatY, 40 * auraPulse, hexToRgba(rColor, 0.25));

      // Visual Chest Box
      renderer.drawRect({
        x: centerX - 35, y: floatY - 35, width: 70, height: 70,
        color: hexToRgba("#1A202C", 1)
      });
      renderer.drawRing(centerX, floatY, 35, 3, hexToRgba(rColor, 1));

      // Glowing text banner
      renderer.drawText({
        text: "CHEST DISCOVERED!",
        x: centerX, y: floatY - 90, font: BONUSTIME_TITLE_FONT,
        color: "#E2E8F0", align: 'center', baseline: 'middle'
      });

      renderer.drawText({
        text: `${tierCfg?.rarity.toUpperCase()} CHEST`,
        x: centerX, y: floatY + 95, font: BONUSTIME_TITLE_FONT,
        color: rColor, align: 'center', baseline: 'middle'
      });

      renderer.drawText({
        text: `Unlocked on Step ${opening.step}`,
        x: centerX, y: floatY + 130, font: BONUSTIME_BODY_FONT,
        color: "#718096", align: 'center', baseline: 'middle'
      });
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
      x: centerX, y: cardRect.y + 50, font: BONUSTIME_TITLE_FONT,
      color: "#D69E2E", align: 'center', baseline: 'middle'
    });

    const chests = getDiscoveredChests();

    renderer.drawText({
      text: `You have successfully completed exploration.`,
      x: centerX, y: cardRect.y + 95, font: BONUSTIME_BODY_FONT,
      color: "#A0AEC0", align: 'center', baseline: 'middle'
    });

    renderer.drawText({
      text: `You found ${chests.length} reward chests`,
      x: centerX, y: cardRect.y + 125, font: BONUSTIME_TITLE_FONT,
      color: "#E2E8F0", align: 'center', baseline: 'middle'
    });

    // Row of discovered chests inside results panel
    const rowY = cardRect.y + 160;
    const slotSize = 48;
    const slotGap = 12;
    const totalRowWidth = chests.length * slotSize + (chests.length - 1) * slotGap;
    const startX = centerX - totalRowWidth / 2;

    for (let i = 0; i < chests.length; i++) {
      const ch = chests[i];
      const slotX = startX + i * (slotSize + slotGap);
      const tierCfg = getTierConfig(ch.tier);
      const rColor = tierCfg ? tierCfg.color : "#FFFFFF";

      renderer.drawRect({
        x: slotX, y: rowY, width: slotSize, height: slotSize,
        color: hexToRgba("#2D3748", 0.6)
      });
      renderer.drawRing(slotX + slotSize / 2, rowY + slotSize / 2, slotSize / 2 - 2, 2, hexToRgba(rColor, 1));
      renderer.drawText({
        text: `T${ch.tier}`,
        x: slotX + slotSize / 2, y: rowY + slotSize / 2, font: BONUSTIME_BODY_FONT,
        color: rColor, align: 'center', baseline: 'middle'
      });
    }

    // Consolation reward note if applicable
    if (chests.length === 0) {
      renderer.drawText({
        text: "+ Tier 1 Consolation Chest Awarded",
        x: centerX, y: cardRect.y + 225, font: BONUSTIME_BODY_FONT,
        color: "#A0AEC0", align: 'center', baseline: 'middle'
      });
    }

    // Claim rewards button
    const claimBtn = { x: centerX - 100, y: cardRect.y + 255, width: 200, height: 45 };
    const hovered = pointer &&
      pointer.x >= claimBtn.x && pointer.x <= claimBtn.x + claimBtn.width &&
      pointer.y >= claimBtn.y && pointer.y <= claimBtn.y + claimBtn.height;

    drawButton(claimBtn, "CLAIM ALL REWARDS", {
      font: BONUSTIME_BUTTON_FONT,
      active: !!hovered,
      activeSurface: "#B7791F",
      inactiveSurface: "#1A202C",
      activeBorder: "#D69E2E",
      inactiveBorder: "#2D3748",
      textColor: "#ffffff"
    });
  }
}
