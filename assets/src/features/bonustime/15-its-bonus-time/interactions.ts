import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { ItsBonusTimeData } from "./view-model";
import {
  BONUSTIME_REWARD_MODAL_DELAY_MS,
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton
} from "../flow";

export enum ItsBonusTimeState {
  IDLE,
  PLAYING,
  FINAL_REVEAL,
  REVEALED
}

let internalState = ItsBonusTimeState.IDLE;
const flippedIndices = new Set<number>();
const restFlippedIndices = new Set<number>();
const revealIndexMap = new Map<number, number>();
let clickedSequence: number[] = [];
let remainingIndices: number[] = [];
let finalRevealStartTime = 0;
let claimSent = false;
let hoveredIndex: number | null = null;

export function getItsBonusTimeState() { return internalState; }
export function getFlippedIndices(): ReadonlySet<number> { return flippedIndices; }
export function getRestFlippedIndices(): ReadonlySet<number> { return restFlippedIndices; }
export function getRevealIndexMap(): ReadonlyMap<number, number> { return revealIndexMap; }
export function getClickedSequence(): readonly number[] { return clickedSequence; }
export function getFinalRevealStartTime() { return finalRevealStartTime; }
export function getRemainingIndices(): readonly number[] { return remainingIndices; }
export function getItsHoveredIndex() { return hoveredIndex; }

export function resetItsBonusTimeState() {
  internalState = ItsBonusTimeState.IDLE;
  flippedIndices.clear();
  restFlippedIndices.clear();
  revealIndexMap.clear();
  clickedSequence = [];
  remainingIndices = [];
  finalRevealStartTime = 0;
  claimSent = false;
  hoveredIndex = null;
}

export function handleItsBonusTimeInteractions(
  input: InteractionState,
  data: ItsBonusTimeData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();
  hoveredIndex = null;

  // Grid layout details
  const cols = 16;
  const rows = 8;
  const tileSize = 55;
  const gap = 4;
  const totalGridWidth = cols * tileSize + (cols - 1) * gap;
  const totalGridHeight = rows * tileSize + (rows - 1) * gap;

  const gridStartX = gameRect.x + (gameRect.width - totalGridWidth) / 2;
  const gridStartY = gameRect.y + 110;
  const welcomeLayout = getBonusTimeWelcomeLayout(gameRect, {
    cardWidth: 600,
    cardHeight: 360,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  if (internalState === ItsBonusTimeState.IDLE) {
    if (isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) && input.clicked && !input.consumed && data.hasToken && channel && !claimSent) {
      claimSent = true;
      internalState = ItsBonusTimeState.PLAYING;
      flippedIndices.clear();
      restFlippedIndices.clear();
      revealIndexMap.clear();
      clickedSequence = [];
      remainingIndices = [];
      finalRevealStartTime = 0;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "its_bonus_time"));
      } else {
        playBonusTime(channel, "its_bonus_time");
      }
      input.consumed = true;
    }
  } else if (internalState === ItsBonusTimeState.PLAYING) {
    if (!data.lastResult) return null;

    const board = data.lastResult.board;
    const flips = data.lastResult.flips;

    // Track hovered index across all 128 tiles
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
      if (!flippedIndices.has(idx) && clickedSequence.length < flips) {
        flippedIndices.add(idx);
        clickedSequence.push(idx);

        // Map clicked index to next consecutive server result element
        const revealValue = board[clickedSequence.length - 1];
        revealIndexMap.set(idx, revealValue);

        input.consumed = true;

        // Check if all flips are spent
        if (clickedSequence.length === flips) {
          internalState = ItsBonusTimeState.FINAL_REVEAL;
          finalRevealStartTime = now;

          // Compute unclicked tile indices in a stable order
          remainingIndices = [];
          for (let i = 0; i < 128; i++) {
            if (!flippedIndices.has(i)) {
              remainingIndices.push(i);
            }
          }
        }
      }
    }
  } else if (internalState === ItsBonusTimeState.FINAL_REVEAL) {
    if (!data.lastResult) return null;

    const board = data.lastResult.board;
    const flips = data.lastResult.flips;

    const elapsed = now - finalRevealStartTime;
    // Wish 1 & 2: Pause 2 seconds, then flip one-by-one at 20 ms / flip
    const elapsedSinceFlipStart = elapsed - 2000;
    const tilesToFlip = Math.max(0, Math.floor(elapsedSinceFlipStart / 20));

    for (let i = 0; i < remainingIndices.length; i++) {
      const idx = remainingIndices[i];
      if (i < tilesToFlip) {
        restFlippedIndices.add(idx);
        revealIndexMap.set(idx, board[flips + i]);
      }
    }

    const allRevealedDuration = 2000 + remainingIndices.length * 20;
    if (elapsed >= allRevealedDuration + BONUSTIME_REWARD_MODAL_DELAY_MS) {
      internalState = ItsBonusTimeState.REVEALED;
    }
  } else if (internalState === ItsBonusTimeState.REVEALED) {
    // Show standard reward modal immediately
    return { type: 'open_modal' as const };
  }

  return null;
}
