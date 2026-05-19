import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { CardPickData } from "./view-model";

export enum CardPickState {
  IDLE,
  PLAYING,
  BONUS_PENDING,
  SHUFFLING,
  FINAL_REVEAL,
  REVEALED
}

let internalState = CardPickState.IDLE;
const flippedIndices = new Set<number>();
const restFlippedIndices = new Set<number>();
const revealIndexMap = new Map<number, { tier: number; multiplier: number }>();
let clickedSequence: number[] = [];
let remainingIndices: number[] = [];
let finalRevealStartTime = 0;
let claimSent = false;
let hoveredIndex: number | null = null;

let currentMaxPicks = 0;
let bonusPhaseStartTime = 0;

export function getCardPickState() { return internalState; }
export function getFlippedIndices(): ReadonlySet<number> { return flippedIndices; }
export function getRestFlippedIndices(): ReadonlySet<number> { return restFlippedIndices; }
export function getRevealIndexMap(): ReadonlyMap<number, { tier: number; multiplier: number }> { return revealIndexMap; }
export function getClickedSequence(): readonly number[] { return clickedSequence; }
export function getFinalRevealStartTime() { return finalRevealStartTime; }
export function getRemainingIndices(): readonly number[] { return remainingIndices; }
export function getCardPickHoveredIndex() { return hoveredIndex; }
export function getCurrentMaxPicks() { return currentMaxPicks; }
export function getBonusPhaseStartTime() { return bonusPhaseStartTime; }

export function resetCardPickState() {
  internalState = CardPickState.IDLE;
  flippedIndices.clear();
  restFlippedIndices.clear();
  revealIndexMap.clear();
  clickedSequence = [];
  remainingIndices = [];
  finalRevealStartTime = 0;
  claimSent = false;
  hoveredIndex = null;
  currentMaxPicks = 0;
  bonusPhaseStartTime = 0;
}

export function handleCardPickInteractions(
  input: InteractionState,
  data: CardPickData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();
  hoveredIndex = null;

  // Grid layout details: 6x6 grid
  const cols = 6;
  const rows = 6;
  const tileSize = 65;
  const gap = 10;
  const totalGridWidth = cols * tileSize + (cols - 1) * gap;
  const totalGridHeight = rows * tileSize + (rows - 1) * gap;

  const gridStartX = gameRect.x + (gameRect.width - totalGridWidth) / 2;
  const gridStartY = gameRect.y + 100;

  if (internalState === CardPickState.IDLE) {
    // Play button location (centered)
    const centerX = gameRect.x + gameRect.width / 2;
    const centerY = gameRect.y + gameRect.height / 2;
    const btnRect = { x: centerX - 120, y: centerY + 70, width: 240, height: 50 };

    const isOverBtn = pointerOverRect(input.pointer, btnRect);

    if (isOverBtn && input.clicked && !input.consumed && data.hasToken && channel && !claimSent) {
      claimSent = true;
      internalState = CardPickState.PLAYING;
      flippedIndices.clear();
      restFlippedIndices.clear();
      revealIndexMap.clear();
      clickedSequence = [];
      remainingIndices = [];
      finalRevealStartTime = 0;
      currentMaxPicks = 2 + Math.min(7, Math.floor(Math.max(0, data.streak) / 7)); // baseline flips!
      bonusPhaseStartTime = 0;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "card_pick"));
      } else {
        playBonusTime(channel, "card_pick");
      }
      input.consumed = true;
    }
  } else if (internalState === CardPickState.PLAYING) {
    if (!data.lastResult) return null;

    const board = data.lastResult.board;
    const flips = data.lastResult.flips;

    // Set initial baseline maximum picks if we loaded back in playing state
    if (currentMaxPicks === 0) {
      currentMaxPicks = 2 + Math.min(7, Math.floor(Math.max(0, data.streak) / 7));
    }

    // Track hovered index across all 36 tiles
    if (input.pointer) {
      const px = input.pointer.x;
      const py = input.pointer.y;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const tx = gridStartX + c * (tileSize + gap);
          const ty = gridStartY + r * (tileSize + gap);

          if (px >= tx && px <= tx + tileSize && py >= ty && py <= ty + tileSize) {
            hoveredIndex = idx;
            break;
          }
        }
        if (hoveredIndex !== null) break;
      }
    }

    // Tile click logic
    if (hoveredIndex !== null && input.clicked && !input.consumed) {
      const idx = hoveredIndex;
      if (!flippedIndices.has(idx) && clickedSequence.length < currentMaxPicks) {
        flippedIndices.add(idx);
        clickedSequence.push(idx);

        // Map clicked index to next consecutive server result element
        const revealValue = board[clickedSequence.length - 1];
        revealIndexMap.set(idx, revealValue);

        input.consumed = true;

        // Check if currently allowed flips are spent
        if (clickedSequence.length === currentMaxPicks) {
          if (currentMaxPicks < flips) {
            // We have precomputed bonus picks! Trigger bonus pending phase
            internalState = CardPickState.BONUS_PENDING;
            bonusPhaseStartTime = now;
          } else {
            // No more precomputed picks left, proceed to final reveal
            internalState = CardPickState.FINAL_REVEAL;
            finalRevealStartTime = now;

            remainingIndices = [];
            for (let i = 0; i < 36; i++) {
              if (!flippedIndices.has(i)) {
                remainingIndices.push(i);
              }
            }
          }
        }
      }
    }
  } else if (internalState === CardPickState.BONUS_PENDING) {
    // Wait 5 seconds after picking before starting shuffle
    if (now - bonusPhaseStartTime >= 5000) {
      internalState = CardPickState.SHUFFLING;
      bonusPhaseStartTime = now;
    }
  } else if (internalState === CardPickState.SHUFFLING) {
    // Shuffle animation runs for 1.5 seconds
    if (now - bonusPhaseStartTime >= 1500) {
      currentMaxPicks += 1;
      internalState = CardPickState.PLAYING;
    }
  } else if (internalState === CardPickState.FINAL_REVEAL) {
    if (!data.lastResult) return null;

    const board = data.lastResult.board;
    const flips = data.lastResult.flips;

    const elapsed = now - finalRevealStartTime;
    // Pause 2 seconds, then flip one-by-one at 30 ms / flip
    const elapsedSinceFlipStart = elapsed - 2000;
    const tilesToFlip = Math.max(0, Math.floor(elapsedSinceFlipStart / 30));

    for (let i = 0; i < remainingIndices.length; i++) {
      const idx = remainingIndices[i];
      if (i < tilesToFlip) {
        restFlippedIndices.add(idx);
        revealIndexMap.set(idx, board[flips + i]);
      }
    }

    const allRevealedDuration = 2000 + remainingIndices.length * 30;
    if (elapsed >= allRevealedDuration + 3000) {
      internalState = CardPickState.REVEALED;
    }
  } else if (internalState === CardPickState.REVEALED) {
    return { type: 'open_modal' as const };
  }

  return null;
}

function pointerOverRect(pointer: { x: number; y: number } | null, rect: { x: number; y: number; width: number; height: number }): boolean {
  return !!(pointer &&
            pointer.x >= rect.x && pointer.x <= rect.x + rect.width &&
            pointer.y >= rect.y && pointer.y <= rect.y + rect.height);
}
