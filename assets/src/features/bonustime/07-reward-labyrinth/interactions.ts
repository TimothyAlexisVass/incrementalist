import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { RewardLabyrinthData } from "./view-model";

export enum LabyrinthState {
  IDLE,
  PLAYING,
  CHEST_OPENING,
  FINISHED,
  REVEALED
}

let internalState = LabyrinthState.IDLE;
let currentX = 0;
let currentY = 0;
let stepsRemaining = 0;
const visitedRooms = new Set<string>();
let visitedRoomsCount = 1;
const discoveredChests: { step: number; tier: number; x: number; y: number }[] = [];
let activeChestOpening: { tier: number; step: number; startTime: number } | null = null;
let incomingDir: 'north' | 'south' | 'east' | 'west' | null = null;
let claimSent = false;
let hoveredDirection: 'north' | 'south' | 'east' | 'west' | 'enter' | null = null;

// PRNG Seed based on game play timestamp to ensure random maze layout each game
let mazeSeed = 42;

export function getLabyrinthState() { return internalState; }
export function getCurrentCoords() { return { x: currentX, y: currentY }; }
export function getStepsRemaining() { return stepsRemaining; }
export function getVisitedRoomsCount() { return visitedRoomsCount; }
export function getDiscoveredChests() { return discoveredChests; }
export function getActiveChestOpening() { return activeChestOpening; }
export function getIncomingDir() { return incomingDir; }
export function getHoveredDirection() { return hoveredDirection; }
export function getMazeSeed() { return mazeSeed; }
export function getVisitedRooms() { return visitedRooms; }

export function resetLabyrinthState() {
  internalState = LabyrinthState.IDLE;
  currentX = 0;
  currentY = 0;
  stepsRemaining = 0;
  visitedRooms.clear();
  visitedRoomsCount = 1;
  discoveredChests.length = 0;
  activeChestOpening = null;
  incomingDir = null;
  claimSent = false;
  hoveredDirection = null;
  mazeSeed = 42;
}

// 2D Hash function for procedural grid generation
export function hash2D(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 951214813) ^ 0xdeade10c;
  h = Math.imul(h ^ (h >>> 15), 1597334677);
  h = Math.imul(h ^ (h >>> 13), 382100387);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface RoomConnections {
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

export function getRoomConnections(x: number, y: number, seed: number): RoomConnections {
  const h = hash2D(x, y, seed);
  const conn = { north: false, south: false, east: false, west: false };

  // Roll physical passages (using hash bits)
  let countOpen = 0;
  if ((h & 1) === 0) { conn.north = true; countOpen++; }
  if (((h >>> 1) & 1) === 0) { conn.south = true; countOpen++; }
  if (((h >>> 2) & 1) === 0) { conn.east = true; countOpen++; }
  if (((h >>> 3) & 1) === 0) { conn.west = true; countOpen++; }

  // Enforce at least 2 open pathways so every room has at least 2 options!
  if (countOpen < 2) {
    const options: ('north' | 'south' | 'east' | 'west')[] = ['north', 'south', 'east', 'west'];
    let tries = 0;
    while (countOpen < 2 && tries < 10) {
      const idx = (h >>> (5 + tries)) % options.length;
      const selectedDir = options[idx];
      if (selectedDir && !conn[selectedDir]) {
        conn[selectedDir] = true;
        countOpen++;
      }
      tries++;
    }
  }

  return conn;
}

export function getSymmetricConnections(x: number, y: number, seed: number): RoomConnections {
  const self = getRoomConnections(x, y, seed);
  const north = getRoomConnections(x, y - 1, seed);
  const south = getRoomConnections(x, y + 1, seed);
  const east = getRoomConnections(x + 1, y, seed);
  const west = getRoomConnections(x - 1, y, seed);

  return {
    north: self.north || north.south,
    south: self.south || south.north,
    east: self.east || east.west,
    west: self.west || west.east
  };
}

export function handleLabyrinthInteractions(
  input: InteractionState,
  data: RewardLabyrinthData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();
  hoveredDirection = null;

  const centerX = gameRect.x + gameRect.width / 2;
  const centerY = gameRect.y + gameRect.height / 2;

  if (internalState === LabyrinthState.IDLE) {
    const cardRectY = centerY - 200;
    const btnRect = { x: centerX - 120, y: cardRectY + 240, width: 240, height: 50 };
    const isOverBtn = pointerOverRect(input.pointer, btnRect);

    if (isOverBtn) {
      hoveredDirection = 'enter';
    }

    if (isOverBtn && input.clicked && !input.consumed && data.hasToken && channel && !claimSent) {
      claimSent = true;
      stepsRemaining = 0;
      visitedRooms.clear();
      visitedRoomsCount = 1;
      discoveredChests.length = 0;
      activeChestOpening = null;
      incomingDir = null;
      mazeSeed = Math.floor(now) ^ 104297;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "reward_labyrinth"));
      } else {
        playBonusTime(channel, "reward_labyrinth");
      }
      input.consumed = true;
    }

    // transition to playing when server data loaded
    if (claimSent && data.lastResult) {
      stepsRemaining = data.lastResult.steps_total;
      visitedRooms.add("0,0");
      internalState = LabyrinthState.PLAYING;
    }
  } else if (internalState === LabyrinthState.PLAYING) {
    if (!data.lastResult) return null;

    const connections = getSymmetricConnections(currentX, currentY, mazeSeed);

    // Direction layout buttons centered on the relative map grid cells
    const buttonSize = 40;
    const offset = 56;
    const mapCenterY = centerY - 20;

    const northRect = { x: centerX - buttonSize / 2, y: mapCenterY - offset - buttonSize / 2, width: buttonSize, height: buttonSize };
    const southRect = { x: centerX - buttonSize / 2, y: mapCenterY + offset - buttonSize / 2, width: buttonSize, height: buttonSize };
    const eastRect = { x: centerX + offset - buttonSize / 2, y: mapCenterY - buttonSize / 2, width: buttonSize, height: buttonSize };
    const westRect = { x: centerX - offset - buttonSize / 2, y: mapCenterY - buttonSize / 2, width: buttonSize, height: buttonSize };

    // Walkability rules: A door is only walkable if open, and if stepsRemaining <= 0, it must lead to a visited room (backtrack only)
    const isNorthWalkable = connections.north && (stepsRemaining > 0 || visitedRooms.has(`${currentX},${currentY - 1}`));
    const isSouthWalkable = connections.south && (stepsRemaining > 0 || visitedRooms.has(`${currentX},${currentY + 1}`));
    const isEastWalkable = connections.east && (stepsRemaining > 0 || visitedRooms.has(`${currentX + 1},${currentY}`));
    const isWestWalkable = connections.west && (stepsRemaining > 0 || visitedRooms.has(`${currentX - 1},${currentY}`));

    if (isNorthWalkable && pointerOverRect(input.pointer, northRect)) hoveredDirection = 'north';
    else if (isSouthWalkable && pointerOverRect(input.pointer, southRect)) hoveredDirection = 'south';
    else if (isEastWalkable && pointerOverRect(input.pointer, eastRect)) hoveredDirection = 'east';
    else if (isWestWalkable && pointerOverRect(input.pointer, westRect)) hoveredDirection = 'west';

    // Finish Run button interaction
    const finishBtn = { x: centerX - 80, y: centerY + 145, width: 160, height: 35 };
    const isOverFinish = pointerOverRect(input.pointer, finishBtn);

    if (isOverFinish && input.clicked && !input.consumed) {
      input.consumed = true;
      internalState = LabyrinthState.FINISHED;
      return null;
    }

    if (isOverFinish) {
      hoveredDirection = null; // Don't hover maze direction when hovering finish button
    }

    if (hoveredDirection && input.clicked && !input.consumed) {
      const dir = hoveredDirection;
      let nextX = currentX;
      let nextY = currentY;

      if (dir === 'north') { nextY -= 1; }
      else if (dir === 'south') { nextY += 1; }
      else if (dir === 'east') { nextX += 1; }
      else if (dir === 'west') { nextX -= 1; }

      const coordKey = `${nextX},${nextY}`;
      const isNewRoom = !visitedRooms.has(coordKey);

      currentX = nextX;
      currentY = nextY;

      if (isNewRoom) {
        stepsRemaining -= 1;
        visitedRooms.add(coordKey);
        visitedRoomsCount += 1;

        // Check if there is a chest pre-rolled at this room visited threshold
        const matchingChest = data.lastResult.chests.find(c => c.step === visitedRoomsCount);
        if (matchingChest) {
          discoveredChests.push({
            step: matchingChest.step,
            tier: matchingChest.tier,
            x: currentX,
            y: currentY
          });

          // Trigger chest opening cinematic!
          internalState = LabyrinthState.CHEST_OPENING;
          activeChestOpening = {
            tier: matchingChest.tier,
            step: matchingChest.step,
            startTime: now
          };
        }
      }

      input.consumed = true;

      // Check if step budget is empty
      if (stepsRemaining <= 0 && internalState === LabyrinthState.PLAYING) {
        internalState = LabyrinthState.FINISHED;
      }
    }
  } else if (internalState === LabyrinthState.CHEST_OPENING) {
    if (activeChestOpening && now - activeChestOpening.startTime >= 2500) {
      activeChestOpening = null;
      if (stepsRemaining <= 0) {
        internalState = LabyrinthState.FINISHED;
      } else {
        internalState = LabyrinthState.PLAYING;
      }
    }
  } else if (internalState === LabyrinthState.FINISHED) {
    // Finished state shows summary. Clicking anywhere or clicking claim goes to unified modal.
    const cardRectY = centerY - 200;
    const closeBtn = { x: centerX - 100, y: cardRectY + 255, width: 200, height: 45 };
    if (pointerOverRect(input.pointer, closeBtn) && input.clicked && !input.consumed) {
      input.consumed = true;
      internalState = LabyrinthState.REVEALED;
      return { type: 'open_modal' as const };
    }
  }

  return null;
}

function pointerOverRect(pointer: { x: number; y: number } | null, rect: { x: number; y: number; width: number; height: number }): boolean {
  return !!(pointer &&
            pointer.x >= rect.x && pointer.x <= rect.x + rect.width &&
            pointer.y >= rect.y && pointer.y <= rect.y + rect.height);
}
