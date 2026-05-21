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
      chances: number[];
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
  color: { r: number; g: number; b: number };
};

export type ScratchCardEndReward = {
  tier: number;
  cellX: number;
  cellY: number;
  sizeCells: number;
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
let hasScratchStarted = false;
let previousScratchBoardPoint: { x: number; y: number } | null = null;
let endRewards: ScratchCardEndReward[] = [];
let deferredRevealOrigin: { x: number; y: number } | null = null;
const SCRATCH_INTERPOLATION_SPACING_PX = Math.max(1, Math.min(BRUSH_WIDTH_PX, BRUSH_HEIGHT_PX) * 0.5);
const MAX_SCRATCH_SPEED_PX_PER_FRAME = 50;
const SCRATCH_SURFACE_FADE_MS = 3000;
const END_REWARD_MIN_GAP_CELLS = 6;
const END_MISSED_TOTAL_TARGET = 15;
export const SCRATCH_CARD_WELCOME_LAYOUT_OPTIONS = {
  cardWidth: 580,
  cardHeight: 360,
  buttonWidth: 240,
  buttonHeight: 50,
  cardYOffset: -20,
  buttonOffsetY: 70
} as const;

export function getScratchCardWelcomeLayout(gameRect: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return getBonusTimeWelcomeLayout(gameRect, SCRATCH_CARD_WELCOME_LAYOUT_OPTIONS);
}

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

export function getScratchCardEndRewards(): readonly ScratchCardEndReward[] {
  return endRewards;
}

export function getScratchCardSurfaceAlpha(now: number): number {
  if (internalState !== ScratchCardState.REVEALED || rewardWaitStartedAt <= 0) {
    return 1;
  }

  const progress = clamp((now - rewardWaitStartedAt) / SCRATCH_SURFACE_FADE_MS, 0, 1);
  return 1 - progress;
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
  resetScratchRunProjection(0);
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
  const welcomeLayout = getScratchCardWelcomeLayout(gameRect);

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
      resetScratchRunProjection(now);
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

  if (internalState === ScratchCardState.PLAYING) {
    if (pointerLogical && (input.isPressed || hasScratchStarted) && !isScratchRunResolved(data.lastResult)) {
      const segmentPoints = getScratchSegmentPoints(previousScratchBoardPoint, pointerLogical);
      for (const boardPoint of segmentPoints) {
        applyScratchTouch(data.lastResult, boardPoint, now);
      }
      previousScratchBoardPoint = segmentPoints[segmentPoints.length - 1] ?? pointerLogical;
      input.consumed = true;
    }
  }

  if (
    internalState === ScratchCardState.PLAYING &&
    scratchedPixels >= data.lastResult.pixels_budget &&
    nextRevealIndex >= data.lastResult.reveal_schedule.length
  ) {
    const targetMissedCount = Math.max(
      0,
      END_MISSED_TOTAL_TARGET - data.lastResult.reveal_schedule.length
    );
    const fillerTiers = Array.from({ length: targetMissedCount }, () => sampleScratchTier());
    endRewards = createDeferredRewards(fillerTiers);
    nextRevealIndex = data.lastResult.reveal_schedule.length;
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
  resetScratchRunProjection(now);
}

function createDeferredRewards(tiers: number[]): ScratchCardEndReward[] {
  const minAnchorX = 0;
  const maxAnchorX = GRID_COLS - REVEAL_COVER_SIZE_CELLS;
  const minAnchorY = 0;
  const maxAnchorY = GRID_ROWS - REVEAL_COVER_SIZE_CELLS;
  if (maxAnchorX < minAnchorX || maxAnchorY < minAnchorY) {
    return [];
  }

  const scratchPrefixSums = buildScratchPrefixSums(scratchedMask);
  const candidateAnchors: number[] = [];
  const revealBlockSize = REVEAL_COVER_SIZE_CELLS;
  const anchorStride = maxAnchorX - minAnchorX + 1;
  const hasRevealVisuals = revealVisuals.length > 0;

  for (let cellY = minAnchorY; cellY <= maxAnchorY; cellY += 1) {
    for (let cellX = minAnchorX; cellX <= maxAnchorX; cellX += 1) {
      if (countScratchedCellsInBlock(scratchPrefixSums, cellX, cellY, revealBlockSize) !== 0) {
        continue;
      }

      if (hasRevealVisuals) {
        let overlapsRevealed = false;
        for (const revealed of revealVisuals) {
          if (
            rectsOverlap(
              cellX,
              cellY,
              revealBlockSize,
              revealed.cellX,
              revealed.cellY,
              revealed.sizeCells
            )
          ) {
            overlapsRevealed = true;
            break;
          }
        }
        if (overlapsRevealed) continue;
      }

      candidateAnchors.push(((cellY - minAnchorY) * anchorStride) + (cellX - minAnchorX));
    }
  }

  if (candidateAnchors.length === 0 || tiers.length <= 0) return [];

  for (let i = candidateAnchors.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = candidateAnchors[i];
    candidateAnchors[i] = candidateAnchors[j];
    candidateAnchors[j] = tmp;
  }

  const rewardCount = Math.min(tiers.length, candidateAnchors.length);
  for (let gap = END_REWARD_MIN_GAP_CELLS; gap >= 0; gap -= 1) {
    const selected: ScratchCardEndReward[] = [];
    for (const encodedAnchor of candidateAnchors) {
      if (selected.length >= rewardCount) break;
      const localX = encodedAnchor % anchorStride;
      const localY = Math.floor(encodedAnchor / anchorStride);
      const cellX = minAnchorX + localX;
      const cellY = minAnchorY + localY;

      let overlapsSelected = false;
      for (const reward of selected) {
        if (
          rectsOverlapWithGap(
            cellX,
            cellY,
            revealBlockSize,
            reward.cellX,
            reward.cellY,
            reward.sizeCells,
            gap
          )
        ) {
          overlapsSelected = true;
          break;
        }
      }

      let overlapsExistingDeferred = false;
      if (!overlapsSelected && endRewards.length > 0) {
        for (const reward of endRewards) {
          if (
            rectsOverlapWithGap(
              cellX,
              cellY,
              revealBlockSize,
              reward.cellX,
              reward.cellY,
              reward.sizeCells,
              gap
            )
          ) {
            overlapsExistingDeferred = true;
            break;
          }
        }
      }

      if (overlapsSelected || overlapsExistingDeferred) continue;

      selected.push({
        tier: tiers[selected.length],
        cellX,
        cellY,
        sizeCells: revealBlockSize
      });
    }

    if (selected.length >= rewardCount) {
      return selected;
    }
  }

  return candidateAnchors.slice(0, rewardCount).map((encodedAnchor, idx) => ({
    tier: tiers[idx],
    cellX: minAnchorX + (encodedAnchor % anchorStride),
    cellY: minAnchorY + Math.floor(encodedAnchor / anchorStride),
    sizeCells: revealBlockSize
  }));
}

function buildScratchPrefixSums(mask: Uint8Array): Uint32Array {
  const stride = GRID_COLS + 1;
  const prefix = new Uint32Array((GRID_ROWS + 1) * stride);

  for (let row = 1; row <= GRID_ROWS; row += 1) {
    const maskRowOffset = (row - 1) * GRID_COLS;
    const prefixRowOffset = row * stride;
    const prevPrefixRowOffset = (row - 1) * stride;
    let rowSum = 0;

    for (let col = 1; col <= GRID_COLS; col += 1) {
      rowSum += mask[maskRowOffset + col - 1];
      prefix[prefixRowOffset + col] = prefix[prevPrefixRowOffset + col] + rowSum;
    }
  }

  return prefix;
}

function countScratchedCellsInBlock(
  prefix: Uint32Array,
  startX: number,
  startY: number,
  size: number
): number {
  const x0 = startX;
  const y0 = startY;
  const x1 = startX + size;
  const y1 = startY + size;
  const stride = GRID_COLS + 1;

  return (
    prefix[y1 * stride + x1] -
    prefix[y0 * stride + x1] -
    prefix[y1 * stride + x0] +
    prefix[y0 * stride + x0]
  );
}

function rectsOverlapWithGap(
  ax: number,
  ay: number,
  aSize: number,
  bx: number,
  by: number,
  bSize: number,
  gapCells: number
): boolean {
  return (
    ax < (bx + bSize + gapCells) &&
    (ax + aSize + gapCells) > bx &&
    ay < (by + bSize + gapCells) &&
    (ay + aSize + gapCells) > by
  );
}

function rectsOverlap(
  ax: number,
  ay: number,
  aSize: number,
  bx: number,
  by: number,
  bSize: number
): boolean {
  return ax < bx + bSize && ax + aSize > bx && ay < by + bSize && ay + aSize > by;
}

function sampleScratchTier(): number {
  const chances = SCRATCH_RULES.chances;
  let total = 0;
  for (const chance of chances) {
    total += chance;
  }
  if (total <= 0) return 1;

  let roll = Math.random() * total;
  for (let index = 0; index < chances.length; index += 1) {
    roll -= chances[index];
    if (roll <= 0) return index + 1;
  }

  return chances.length;
}

function getScratchSegmentPoints(
  fromPoint: { x: number; y: number } | null,
  toPoint: { x: number; y: number }
): { x: number; y: number }[] {
  if (!fromPoint) return [toPoint];

  const rawDx = toPoint.x - fromPoint.x;
  const rawDy = toPoint.y - fromPoint.y;
  const rawDistance = Math.hypot(rawDx, rawDy);
  const speedScale =
    rawDistance > MAX_SCRATCH_SPEED_PX_PER_FRAME
      ? MAX_SCRATCH_SPEED_PX_PER_FRAME / rawDistance
      : 1;

  const dx = rawDx * speedScale;
  const dy = rawDy * speedScale;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return [toPoint];

  const steps = Math.max(1, Math.ceil(distance / SCRATCH_INTERPOLATION_SPACING_PX));
  const points: { x: number; y: number }[] = [];

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    points.push({
      x: fromPoint.x + dx * t,
      y: fromPoint.y + dy * t
    });
  }

  return points;
}

function applyScratchTouch(lastResult: ScratchCardLastResult, boardPoint: { x: number; y: number }, now: number) {
  const scratchedPixelsBeforeTouch = scratchedPixels;
  const nextThreshold = lastResult.reveal_schedule[nextRevealIndex]?.pixels;

  const newCells = scratchWithBrush(boardPoint, now);

  if (newCells > 0) {
    if (!hasScratchStarted) {
      hasScratchStarted = true;
    }
    scratchedPixels = Math.min(
      lastResult.pixels_budget,
      scratchedPixels + (newCells * SCRATCH_CELL_PIXELS)
    );
  }

  if (typeof nextThreshold !== "number") {
    return;
  }

  if (scratchedPixelsBeforeTouch < nextThreshold && scratchedPixels >= nextThreshold) {
    deferredRevealOrigin = { x: boardPoint.x, y: boardPoint.y };
    return;
  }

  if (scratchedPixelsBeforeTouch < nextThreshold) {
    return;
  }

  if (deferredRevealOrigin) {
    const distanceFromThresholdCross = Math.hypot(
      boardPoint.x - deferredRevealOrigin.x,
      boardPoint.y - deferredRevealOrigin.y
    );
    const minRevealDistance = REVEAL_COVER_SIZE_CELLS * CELL_SIZE_PX;
    if (distanceFromThresholdCross < minRevealDistance) {
      return;
    }
  }

  const revealIndexBefore = nextRevealIndex;
  resolveEligibleReveals(lastResult, boardPoint, now);
  if (nextRevealIndex > revealIndexBefore) {
    deferredRevealOrigin = null;
  }
}

function resolveEligibleReveals(
  lastResult: ScratchCardLastResult,
  boardPoint: { x: number; y: number },
  now: number
) {
  while (nextRevealIndex < lastResult.reveal_schedule.length) {
    const nextReveal = lastResult.reveal_schedule[nextRevealIndex];
    if (scratchedPixels < nextReveal.pixels) break;
    const didReveal = tryReveal(lastResult, nextReveal, boardPoint, now);
    if (!didReveal) break;
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

      if (spawnedParticles < 2) {
        spawnCellParticles(x, y, now, 1);
        spawnedParticles += 1;
      }
    }
  }

  return newCells;
}

function tryReveal(
  lastResult: ScratchCardLastResult,
  nextReveal: ScratchCardLastResult["reveal_schedule"][number],
  boardPoint: { x: number; y: number },
  now: number
): boolean {
  const anchor = findRevealAnchor(boardPoint);
  if (!anchor) return false;

  revealVisuals.push({
    tier: nextReveal.tier,
    thresholdPixels: nextReveal.pixels,
    cellX: anchor.x,
    cellY: anchor.y,
    sizeCells: REVEAL_COVER_SIZE_CELLS
  });

  const revealCells = pickRandomRevealCellsInRevealBlock(
    anchor.x,
    anchor.y,
    REVEAL_COVER_SIZE_CELLS,
    REVEAL_COVER_SIZE_CELLS * 10
  );
  let blockNewCells = 0;
  for (const cell of revealCells) {
    const index = cell.y * GRID_COLS + cell.x;
    if (scratchedMask[index] !== 0) continue;
    scratchedMask[index] = 1;
    scratchedIndices.push(index);
    blockNewCells += 1;
  }

  if (blockNewCells > 0) {
    scratchedPixels = Math.min(
      lastResult.pixels_budget,
      scratchedPixels + RELEASE_PENALTY_PIXELS
    );
  }

  spawnRevealBurst(anchor.x, anchor.y, now);
  nextRevealIndex += 1;
  return true;
}

function pickRandomRevealCellsInRevealBlock(
  anchorX: number,
  anchorY: number,
  blockSizeCells: number,
  targetCount: number
): Array<{ x: number; y: number }> {
  const maxCount = Math.min(targetCount, blockSizeCells * blockSizeCells);
  const centerX = anchorX + Math.floor(blockSizeCells / 2);
  const centerY = anchorY + Math.floor(blockSizeCells / 2);
  const minX = anchorX;
  const maxX = anchorX + blockSizeCells - 1;
  const minY = anchorY;
  const maxY = anchorY + blockSizeCells - 1;
  const selected = new Set<string>();
  const cells: Array<{ x: number; y: number }> = [];

  const tryAddCell = (x: number, y: number) => {
    if (x < minX || y < minY || x > maxX || y > maxY) return false;
    const key = `${x}:${y}`;
    if (selected.has(key)) return false;
    selected.add(key);
    cells.push({ x, y });
    return true;
  };

  tryAddCell(centerX, centerY);
  let walkX = centerX;
  let walkY = centerY;
  const maxWalkSteps = maxCount * 10;

  for (let step = 0; step < maxWalkSteps && cells.length < maxCount; step += 1) {
    const dir = Math.floor(Math.random() * 4);
    if (dir === 0) walkX += 1;
    else if (dir === 1) walkX -= 1;
    else if (dir === 2) walkY += 1;
    else walkY -= 1;

    walkX = clamp(walkX, minX, maxX);
    walkY = clamp(walkY, minY, maxY);
    tryAddCell(walkX, walkY);
  }

  if (cells.length >= maxCount) {
    return cells;
  }

  for (let y = minY; y <= maxY && cells.length < maxCount; y += 1) {
    for (let x = minX; x <= maxX && cells.length < maxCount; x += 1) {
      tryAddCell(x, y);
    }
  }

  if (cells.length >= maxCount) {
    return cells;
  }

  return cells.slice(0, maxCount);
}

function findRevealAnchor(boardPoint: { x: number; y: number }): { x: number; y: number } | null {
  const maxAnchorX = GRID_COLS - REVEAL_COVER_SIZE_CELLS;
  const maxAnchorY = GRID_ROWS - REVEAL_COVER_SIZE_CELLS;
  if (maxAnchorX < 0 || maxAnchorY < 0) return null;

  const centerCellX = clamp(Math.floor(boardPoint.x / CELL_SIZE_PX), 0, GRID_COLS - 1);
  const centerCellY = clamp(Math.floor(boardPoint.y / CELL_SIZE_PX), 0, GRID_ROWS - 1);
  const preferredAnchorX = clamp(
    centerCellX - Math.floor(REVEAL_COVER_SIZE_CELLS / 2),
    0,
    maxAnchorX
  );
  const preferredAnchorY = clamp(
    centerCellY - Math.floor(REVEAL_COVER_SIZE_CELLS / 2),
    0,
    maxAnchorY
  );
  const localRange = REVEAL_COVER_SIZE_CELLS;
  const minAnchorX = clamp(preferredAnchorX - localRange, 0, maxAnchorX);
  const maxLocalAnchorX = clamp(preferredAnchorX + localRange, 0, maxAnchorX);
  const minAnchorY = clamp(preferredAnchorY - localRange, 0, maxAnchorY);
  const maxLocalAnchorY = clamp(preferredAnchorY + localRange, 0, maxAnchorY);

  const visited = new Set<string>();
  const maxRadius = Math.max(
    Math.abs(preferredAnchorX - minAnchorX),
    Math.abs(preferredAnchorX - maxLocalAnchorX),
    Math.abs(preferredAnchorY - minAnchorY),
    Math.abs(preferredAnchorY - maxLocalAnchorY)
  );

  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const onRing = radius === 0 || Math.abs(dx) === radius || Math.abs(dy) === radius;
        if (!onRing) continue;

        const anchorX = clamp(preferredAnchorX + dx, minAnchorX, maxLocalAnchorX);
        const anchorY = clamp(preferredAnchorY + dy, minAnchorY, maxLocalAnchorY);
        const key = `${anchorX}:${anchorY}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (
          isUnscratchedBlock(anchorX, anchorY, REVEAL_COVER_SIZE_CELLS) &&
          !overlapsRevealVisual(anchorX, anchorY, REVEAL_COVER_SIZE_CELLS)
        ) {
          return { x: anchorX, y: anchorY };
        }
      }
    }
  }

  return null;
}

function overlapsRevealVisual(anchorX: number, anchorY: number, sizeCells: number): boolean {
  return revealVisuals.some((reveal) =>
    rectsOverlap(anchorX, anchorY, sizeCells, reveal.cellX, reveal.cellY, reveal.sizeCells)
  );
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
      lifeMs: 680 + Math.random() * 360,
      alpha: 0.85,
      color: randomScratchParticleColor()
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
      lifeMs: 1040 + Math.random() * 560,
      alpha: 0.95,
      color: randomScratchParticleColor()
    });
  }
}

function randomScratchParticleColor() {
  const t = Math.random();
  return {
    r: 0.82 + (0.98 - 0.82) * t,
    g: 0.58 + (0.88 - 0.58) * t,
    b: 0.06 + (0.36 - 0.06) * t
  };
}

function tickParticles(now: number) {
  if (particles.length === 0) {
    lastTickAt = now;
    return;
  }

  const dtMs = lastTickAt > 0 ? now - lastTickAt : 16.67;
  const dt = Math.max(0, dtMs / 1000);
  lastTickAt = now;

  let writeIndex = 0;
  for (let readIndex = 0; readIndex < particles.length; readIndex += 1) {
    const particle = particles[readIndex];
    const age = now - particle.bornAt;
    if (age >= particle.lifeMs) continue;

    const progress = age / particle.lifeMs;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 80 * dt;
    particle.alpha = Math.max(0, 1 - (progress * 0.55));
    particles[writeIndex] = particle;
    writeIndex += 1;
  }

  particles.length = writeIndex;
}

function resetScratchRunProjection(now: number) {
  scratchedMask = new Uint8Array(GRID_TOTAL_CELLS);
  scratchedIndices = [];
  scratchedPixels = 0;
  nextRevealIndex = 0;
  revealVisuals = [];
  particles = [];
  rewardWaitStartedAt = 0;
  lastTickAt = now;
  hoverBoardPoint = null;
  hasScratchStarted = false;
  previousScratchBoardPoint = null;
  endRewards = [];
  deferredRevealOrigin = null;
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


function isScratchRunResolved(lastResult: ScratchCardLastResult) {
  return (
    scratchedPixels >= lastResult.pixels_budget &&
    nextRevealIndex >= lastResult.reveal_schedule.length
  );
}

function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(maxValue, Math.max(minValue, value));
}
