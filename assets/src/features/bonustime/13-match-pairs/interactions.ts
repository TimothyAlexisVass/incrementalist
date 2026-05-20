import { InteractionState } from "../../../ui/managers/interactions";
import { GameChannel } from "../../../net/game-channel";
import { startMatchPairs, claimMatchPairs } from "../../../net/commands";
import { MatchPairsData } from "./view-model";

export enum MatchPairsState {
  IDLE,
  PLAYING,
  REVEAL_PAUSE,
  MATCH_PAUSE,
  MISS_PAUSE,
  CONSOLATION,
  REVEALED
}

let internalState = MatchPairsState.IDLE;
const known = new Map<number, string>(); // index -> tier (e.g. "tier_1")
const matched = new Set<number>();
let discarded: string[] = []; // array of tiers

let currentTurn = 0;
let firstClickIndex: number | null = null;
let secondClickIndex: number | null = null;

let pauseStartTime = 0;
let hoveredIndex: number | null = null;
let isMatchAnimation = false;

export function getMatchPairsState() { return internalState; }
export function getKnown() { return known; }
export function getMatched() { return matched; }
export function getDiscarded() { return discarded; }
export function getFirstClickIndex() { return firstClickIndex; }
export function getSecondClickIndex() { return secondClickIndex; }
export function getHoveredIndex() { return hoveredIndex; }
export function isMatchAnim() { return isMatchAnimation; }

export function resetMatchPairsState() {
  internalState = MatchPairsState.IDLE;
  known.clear();
  matched.clear();
  discarded = [];
  currentTurn = 0;
  firstClickIndex = null;
  secondClickIndex = null;
  pauseStartTime = 0;
  hoveredIndex = null;
  isMatchAnimation = false;
}

function getFillerTier(exclude: string | null): string {
  // Realistic distribution for memory illusion
  const dist = [
    { tier: "tier_1", w: 40 },
    { tier: "tier_2", w: 30 },
    { tier: "tier_3", w: 15 },
    { tier: "tier_4", w: 8 },
    { tier: "tier_5", w: 4 },
    { tier: "tier_6", w: 2 },
    { tier: "tier_7", w: 1 },
  ];
  
  const available = dist.filter(d => d.tier !== exclude);
  const total = available.reduce((acc, d) => acc + d.w, 0);
  let r = Math.random() * total;
  
  for (const d of available) {
    if (r <= d.w) return d.tier;
    r -= d.w;
  }
  return available[0].tier;
}

function assignCard(index: number, entry: { kind: "miss" | "match"; tier?: string }, isFirstClick: boolean, firstCardTier: string | null): string {
  if (known.has(index)) return known.get(index)!;

  let assignedTier = "tier_1";

  if (entry.kind === "match" && entry.tier) {
    if (isFirstClick) {
      assignedTier = entry.tier;
    } else {
      if (firstCardTier === entry.tier) {
        assignedTier = entry.tier; // Match succeeds
      } else {
        assignedTier = entry.tier; // Enter it onto the board so they miss and it goes to discarded
      }
    }
  } else {
    // Miss turn
    if (isFirstClick) {
      assignedTier = getFillerTier(null);
    } else {
      // Is first card a discarded tier? Recover it!
      if (firstCardTier && discarded.includes(firstCardTier)) {
        assignedTier = firstCardTier;
      } else {
        assignedTier = getFillerTier(firstCardTier);
      }
    }
  }

  known.set(index, assignedTier);
  return assignedTier;
}

export function handleMatchPairsInteractions(
  input: InteractionState,
  data: MatchPairsData,
  gameRect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const now = performance.now();
  hoveredIndex = null;

  // Grid layout: 6 rows, 8 cols
  const cols = 8;
  const rows = 6;
  const tileSize = 60;
  const gap = 10;
  const totalGridWidth = cols * tileSize + (cols - 1) * gap;
  const totalGridHeight = rows * tileSize + (rows - 1) * gap;

  const gridStartX = gameRect.x + (gameRect.width - totalGridWidth) / 2;
  const gridStartY = gameRect.y + 70;

  if (internalState === MatchPairsState.IDLE) {
    const centerX = gameRect.x + gameRect.width / 2;
    const centerY = gameRect.y + gameRect.height / 2;
    const btnRect = { x: centerX - 120, y: centerY + 70, width: 240, height: 50 };

    const isOverBtn = pointerOverRect(input.pointer, btnRect);

    // If we loaded in with an active session, auto-transition to PLAYING
    if (data.lastResult) {
       internalState = MatchPairsState.PLAYING;
       return null;
    }

    if (isOverBtn && input.clicked && !input.consumed && data.hasToken && channel) {
      resetMatchPairsState(); // Clears all local state (sets IDLE)
      internalState = MatchPairsState.PLAYING;

      if (runCommand) {
        runCommand(() => startMatchPairs(channel));
      } else {
        startMatchPairs(channel);
      }
      input.consumed = true;
    }
  } else if (internalState === MatchPairsState.PLAYING) {
    if (!data.lastResult) return null;

    const results = data.lastResult.results;

    // Check hovered tile
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

    if (hoveredIndex !== null && input.clicked && !input.consumed) {
      const idx = hoveredIndex;
      if (!matched.has(idx) && idx !== firstClickIndex) {
        const currentEntry = results[currentTurn];
        
        if (firstClickIndex === null) {
          firstClickIndex = idx;
          assignCard(idx, currentEntry, true, null);
          input.consumed = true;
        } else if (secondClickIndex === null) {
          secondClickIndex = idx;
          const firstCardTier = known.get(firstClickIndex)!;
          const secondCardTier = assignCard(idx, currentEntry, false, firstCardTier);
          input.consumed = true;

          if (firstCardTier === secondCardTier) {
            // Match!
            matched.add(firstClickIndex);
            matched.add(secondClickIndex);

            // Remove from discarded if it was a recovery
            const discardIdx = discarded.indexOf(firstCardTier);
            if (discardIdx >= 0) discarded.splice(discardIdx, 1);

            internalState = MatchPairsState.MATCH_PAUSE;
            isMatchAnimation = true;
          } else {
            // Miss!
            if (currentEntry.kind === "match" && currentEntry.tier) {
              discarded.push(currentEntry.tier);
            }

            internalState = MatchPairsState.MISS_PAUSE;
            isMatchAnimation = false;
          }

          pauseStartTime = now;
        }
      }
    }
  } else if (internalState === MatchPairsState.MATCH_PAUSE || internalState === MatchPairsState.MISS_PAUSE) {
    // Pause to show the two cards before flipping them back or keeping them
    const duration = internalState === MatchPairsState.MATCH_PAUSE ? 800 : 1200;
    
    if (now - pauseStartTime >= duration) {
      // End turn
      if (internalState === MatchPairsState.MISS_PAUSE) {
         // They flip back (we just clear first/second indices)
      }
      
      firstClickIndex = null;
      secondClickIndex = null;
      currentTurn++;

      const results = data.lastResult?.results || [];
      if (currentTurn >= results.length) {
        internalState = MatchPairsState.CONSOLATION;
        pauseStartTime = now;
      } else {
        internalState = MatchPairsState.PLAYING;
      }
    }
  } else if (internalState === MatchPairsState.CONSOLATION) {
    if (now - pauseStartTime >= 1000) {
      internalState = MatchPairsState.REVEALED;
      
      // Auto-reveal the rest of the board for visual consolation
      for (let i = 0; i < 48; i++) {
        if (!known.has(i)) {
          known.set(i, getFillerTier(null));
        }
      }

      if (channel) {
        if (runCommand) {
          runCommand(() => claimMatchPairs(channel, discarded));
        } else {
          claimMatchPairs(channel, discarded);
        }
      }
    }
  } else if (internalState === MatchPairsState.REVEALED) {
    return { type: 'open_modal' as const };
  }

  return null;
}

function pointerOverRect(pointer: { x: number; y: number } | null, rect: { x: number; y: number; width: number; height: number }): boolean {
  return !!(pointer &&
            pointer.x >= rect.x && pointer.x <= rect.x + rect.width &&
            pointer.y >= rect.y && pointer.y <= rect.y + rect.height);
}
