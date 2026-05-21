import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import {
  BONUSTIME_REWARD_MODAL_DELAY_MS,
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton
} from "../flow";
import { fitRectWithinBonusTimeArea } from "../layout";
import { ScratchCardData, ScratchCardLastResult } from "./view-model";

type ScratchCardConfig = {
  game_rules: {
    scratch_card: {
      board_size: {
        width: number;
        height: number;
      };
      grid_cell_size_px: number;
      brush_size: {
        width: number;
        height: number;
      };
      reveal_cover_size_cells: number;
      release_penalty_pixels: number;
    };
  };
};

const SCRATCH_RULES = (bonusTimeConfig as ScratchCardConfig).game_rules.scratch_card;
const BOARD_WIDTH = SCRATCH_RULES.board_size.width;
const BOARD_HEIGHT = SCRATCH_RULES.board_size.height;
const CELL_SIZE_PX = SCRATCH_RULES.grid_cell_size_px;
const BRUSH_WIDTH_PX = SCRATCH_RULES.brush_size.width;
const BRUSH_HEIGHT_PX = SCRATCH_RULES.brush_size.height;
const REVEAL_COVER_SIZE_CELLS = SCRATCH_RULES.reveal_cover_size_cells;
const RELEASE_PENALTY_PIXELS = SCRATCH_RULES.release_penalty_pixels;
const GRID_COLS = Math.floor(BOARD_WIDTH / CELL_SIZE_PX);
const GRID_ROWS = Math.floor(BOARD_HEIGHT / CELL_SIZE_PX);
const GRID_TOTAL_CELLS = GRID_COLS * GRID_ROWS;
const SCRATCH_CELL_PIXELS = CELL_SIZE_PX * CELL_SIZE_PX;
const REVEAL_SEARCH_RADIUS_CELLS = Math.max(GRID_COLS, GRID_ROWS);

export type ScratchBoardRect = { x: number; y: number; width: number; height: number };

export type ScratchCardRevealVisual = {
  tier: number;
  thresholdPixels: number;
  cellX: number;
  cellY: number;
  sizeCells: number;
};

export type ScratchParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  bornAt: number;
  lifeMs: number;
  alpha: number;
};

export enum ScratchCardState {
  IDLE,
  PLAYING,
  REVEALED
}

let internalState = ScratchCardState.IDLE;
let claimSent = false;
let waitingForFreshResult = false;
let startReferencePlayedAt: string | null = null;
let activePlayedAt: string | null = null;
let scratchedMask = new Uint8Array(GRID_TOTAL_CELLS);
let scratchedIndices: number[] = [];
let scratchedPixels = 0;
let nextRevealIndex = 0;
let revealVisuals: ScratchCardRevealVisual[] = [];
let particles: ScratchParticle[] = [];
let rewardWaitStartedAt = 0;
let lastTickAt = 0;
let hoverBoardPoint: { x: number; y: number } | null = null;

export function getScratchCardState() {
  return internalState;
}

export function getScratchCardScratchedPixels() {
  return scratchedPixels;
}

export function getScratchCardScratchedIndices(): readonly number[] {
  return scratchedIndices;
}

export function getScratchCardRevealVisuals(): readonly ScratchCardRevealVisual[] {
  return revealVisuals;
}

export function getScratchCardParticles(): readonly ScratchParticle[] {
  return particles;
}

export function getScratchCardRewardWaitStartedAt() {
  return rewardWaitStartedAt;
}

export function getScratchCardHoverBoardPoint() {
  return hoverBoardPoint;
}

export function getScratchCardBoardRect(
  gameRect: { x: number; y: number; width: number; height: number }
): ScratchBoardRect {
  const boardRect = fitRectWithinBonusTimeArea(gameRect, BOARD_WIDTH, BOARD_HEIGHT, 70);
  return { x: boardRect.x, y: boardRect.y, width: boardRect.width, height: boardRect.height };
}

export function resetScratchCardState() {
  internalState = ScratchCardState.IDLE;
  claimSent = false;
  waitingForFreshResult = false;
  startReferencePlayedAt = null;
  activePlayedAt = null;
  scratchedMask = new Uint8Array(GRID_TOTAL_CELLS);
  scratchedIndices = [];
  scratchedPixels = 0;
  nextRevealIndex = 0;
  revealVisuals = [];
  particles = [];
  rewardWaitStartedAt = 0;
  lastTickAt = 0;
  hoverBoardPoint = null;
}

export function handleScratchCardInteractions(
  input: InteractionState,
  data: ScratchCardData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();
  tickParticles(now);
  hoverBoardPoint = null;

  const boardRect = getScratchCardBoardRect(gameRect);
  const welcomeLayout = getBonusTimeWelcomeLayout(gameRect, {
    cardWidth: 580,
    cardHeight: 360,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  if (internalState === ScratchCardState.IDLE) {
    if (
      isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) &&
      input.clicked &&
      !input.consumed &&
      data.hasToken &&
      channel &&
      !claimSent
    ) {
      claimSent = true;
      waitingForFreshResult = true;
      startReferencePlayedAt = data.lastResult?.played_at ?? null;
      activePlayedAt = null;
      scratchedMask = new Uint8Array(GRID_TOTAL_CELLS);
      scratchedIndices = [];
      scratchedPixels = 0;
      nextRevealIndex = 0;
      revealVisuals = [];
      particles = [];
      rewardWaitStartedAt = 0;
      lastTickAt = now;
      internalState = ScratchCardState.PLAYING;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "scratch_card"));
      } else {
        playBonusTime(channel, "scratch_card");
      }

      input.consumed = true;
    }

    return null;
  }

  if (!data.lastResult) {
    return null;
  }

  if (waitingForFreshResult) {
    if (data.lastResult.played_at === startReferencePlayedAt) {
      return null;
    }

    waitingForFreshResult = false;
    activePlayedAt = null;
  }

  if (activePlayedAt !== data.lastResult.played_at) {
    initializeProjectedRun(data.lastResult, now);
  }

  const pointerLogical = toLogicalBoardPoint(input.pointer, boardRect);
  if (pointerLogical) {
    hoverBoardPoint = pointerLogical;
  }

  if (internalState === ScratchCardState.PLAYING && input.isPressed && pointerLogical) {
    applyScratchTouch(data.lastResult, pointerLogical, now);
    input.consumed = true;
  }

  if (
    internalState === ScratchCardState.PLAYING &&
    scratchedPixels >= data.lastResult.pixels_budget &&
    nextRevealIndex >= data.lastResult.reveal_schedule.length
  ) {
    internalState = ScratchCardState.REVEALED;
    rewardWaitStartedAt = now;
  }

  if (
    internalState === ScratchCardState.REVEALED &&
    rewardWaitStartedAt > 0 &&
    (now - rewardWaitStartedAt) >= BONUSTIME_REWARD_MODAL_DELAY_MS
  ) {
    return { type: "open_modal" as const };
  }

  return null;
}

function initializeProjectedRun(lastResult: ScratchCardLastResult, now: number) {
  activePlayedAt = lastResult.played_at;
  scratchedMask = new Uint8Array(GRID_TOTAL_CELLS);
  scratchedIndices = [];
  scratchedPixels = 0;
  nextRevealIndex = 0;
  revealVisuals = [];
  particles = [];
  rewardWaitStartedAt = 0;
  lastTickAt = now;
}

function applyScratchTouch(lastResult: ScratchCardLastResult, boardPoint: { x: number; y: number }, now: number) {
  const nextReveal = lastResult.reveal_schedule[nextRevealIndex];
  const thresholdReachedBeforeTouch =
    !!nextReveal && scratchedPixels >= nextReveal.pixels;

  const newCells = scratchWithBrush(boardPoint, now);

  if (thresholdReachedBeforeTouch && nextReveal) {
    tryReveal(nextReveal, boardPoint, now);
  }

  if (newCells > 0) {
    scratchedPixels += newCells * SCRATCH_CELL_PIXELS;
  }
}

function scratchWithBrush(boardPoint: { x: number; y: number }, now: number): number {
  const halfBrushWidth = BRUSH_WIDTH_PX / 2;
  const halfBrushHeight = BRUSH_HEIGHT_PX / 2;

  const minX = clamp(Math.floor((boardPoint.x - halfBrushWidth) / CELL_SIZE_PX), 0, GRID_COLS - 1);
  const maxX = clamp(Math.floor((boardPoint.x + halfBrushWidth - 1) / CELL_SIZE_PX), 0, GRID_COLS - 1);
  const minY = clamp(Math.floor((boardPoint.y - halfBrushHeight) / CELL_SIZE_PX), 0, GRID_ROWS - 1);
  const maxY = clamp(Math.floor((boardPoint.y + halfBrushHeight - 1) / CELL_SIZE_PX), 0, GRID_ROWS - 1);

  let newCells = 0;
  let spawnedParticles = 0;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * GRID_COLS + x;
      if (scratchedMask[index] !== 0) continue;

      scratchedMask[index] = 1;
      scratchedIndices.push(index);
      newCells += 1;

      if (spawnedParticles < 16) {
        spawnCellParticles(x, y, now, 2);
        spawnedParticles += 2;
      }
    }
  }

  return newCells;
}

function tryReveal(
  nextReveal: ScratchCardLastResult["reveal_schedule"][number],
  boardPoint: { x: number; y: number },
  now: number
) {
  const anchor = findRevealAnchor(boardPoint);
  if (!anchor) return;

  revealVisuals.push({
    tier: nextReveal.tier,
    thresholdPixels: nextReveal.pixels,
    cellX: anchor.x,
    cellY: anchor.y,
    sizeCells: REVEAL_COVER_SIZE_CELLS
  });

  let blockNewCells = 0;
  for (let y = anchor.y; y < anchor.y + REVEAL_COVER_SIZE_CELLS; y += 1) {
    for (let x = anchor.x; x < anchor.x + REVEAL_COVER_SIZE_CELLS; x += 1) {
      const index = y * GRID_COLS + x;
      if (scratchedMask[index] !== 0) continue;
      scratchedMask[index] = 1;
      scratchedIndices.push(index);
      blockNewCells += 1;
    }
  }

  if (blockNewCells > 0) {
    scratchedPixels += RELEASE_PENALTY_PIXELS;
  }

  spawnRevealBurst(anchor.x, anchor.y, now);
  nextRevealIndex += 1;
}

function findRevealAnchor(boardPoint: { x: number; y: number }): { x: number; y: number } | null {
  const centerCellX = clamp(Math.floor(boardPoint.x / CELL_SIZE_PX), 0, GRID_COLS - 1);
  const centerCellY = clamp(Math.floor(boardPoint.y / CELL_SIZE_PX), 0, GRID_ROWS - 1);
  const centerAnchorX = clamp(centerCellX - Math.floor(REVEAL_COVER_SIZE_CELLS / 2), 0, GRID_COLS - REVEAL_COVER_SIZE_CELLS);
  const centerAnchorY = clamp(centerCellY - Math.floor(REVEAL_COVER_SIZE_CELLS / 2), 0, GRID_ROWS - REVEAL_COVER_SIZE_CELLS);

  const visited = new Set<string>();

  for (let radius = 0; radius <= REVEAL_SEARCH_RADIUS_CELLS; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const onRing = radius === 0 || Math.abs(dx) === radius || Math.abs(dy) === radius;
        if (!onRing) continue;

        const anchorX = clamp(centerAnchorX + dx, 0, GRID_COLS - REVEAL_COVER_SIZE_CELLS);
        const anchorY = clamp(centerAnchorY + dy, 0, GRID_ROWS - REVEAL_COVER_SIZE_CELLS);
        const key = `${anchorX}:${anchorY}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (isUnscratchedBlock(anchorX, anchorY, REVEAL_COVER_SIZE_CELLS)) {
          return { x: anchorX, y: anchorY };
        }
      }
    }
  }

  return null;
}

function isUnscratchedBlock(startX: number, startY: number, size: number): boolean {
  for (let y = startY; y < startY + size; y += 1) {
    for (let x = startX; x < startX + size; x += 1) {
      if (scratchedMask[y * GRID_COLS + x] !== 0) return false;
    }
  }

  return true;
}

function spawnCellParticles(cellX: number, cellY: number, now: number, count: number) {
  const baseX = (cellX * CELL_SIZE_PX) + (CELL_SIZE_PX / 2);
  const baseY = (cellY * CELL_SIZE_PX) + (CELL_SIZE_PX / 2);

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 18 + Math.random() * 28;
    particles.push({
      x: baseX,
      y: baseY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.3 + Math.random() * 1.8,
      bornAt: now,
      lifeMs: 340 + Math.random() * 180,
      alpha: 0.85
    });
  }
}

function spawnRevealBurst(anchorX: number, anchorY: number, now: number) {
  const centerX = ((anchorX + REVEAL_COVER_SIZE_CELLS / 2) * CELL_SIZE_PX);
  const centerY = ((anchorY + REVEAL_COVER_SIZE_CELLS / 2) * CELL_SIZE_PX);

  for (let i = 0; i < 42; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 80;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 3,
      bornAt: now,
      lifeMs: 520 + Math.random() * 280,
      alpha: 0.95
    });
  }
}

function tickParticles(now: number) {
  if (particles.length === 0) {
    lastTickAt = now;
    return;
  }

  const dtMs = lastTickAt > 0 ? now - lastTickAt : 16.67;
  const dt = Math.max(0, dtMs / 1000);
  lastTickAt = now;

  particles = particles
    .map((particle) => {
      const age = now - particle.bornAt;
      if (age >= particle.lifeMs) return null;

      const progress = age / particle.lifeMs;
      return {
        ...particle,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        vy: particle.vy + (80 * dt),
        alpha: Math.max(0, 1 - progress)
      };
    })
    .filter((particle): particle is ScratchParticle => particle !== null);
}

function toLogicalBoardPoint(
  pointer: { x: number; y: number } | null,
  boardRect: ScratchBoardRect
) {
  if (!pointer) return null;
  if (
    pointer.x < boardRect.x ||
    pointer.x > boardRect.x + boardRect.width ||
    pointer.y < boardRect.y ||
    pointer.y > boardRect.y + boardRect.height
  ) {
    return null;
  }

  const x = ((pointer.x - boardRect.x) / boardRect.width) * BOARD_WIDTH;
  const y = ((pointer.y - boardRect.y) / boardRect.height) * BOARD_HEIGHT;

  return {
    x: clamp(x, 0, BOARD_WIDTH - 1),
    y: clamp(y, 0, BOARD_HEIGHT - 1)
  };
}

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}
