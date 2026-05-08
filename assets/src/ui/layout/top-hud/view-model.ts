import { lerp } from "../../../utils";
import { BigNum, ZERO } from "../../../core/bignum";

export type HudViewModel = {
  displayedExp: BigNum;
  displayedLevel: number;
  displayedCoins: BigNum;
  displayedShards: BigNum;
  displayedCores: BigNum;
  
  // Level up visual state
  collectionGlowStartedAt: number;
  particles: {
    x: number; y: number; vx: number; vy: number; drag: number;
    radius: number; lineWidth: number; color: string; gravity: number;
    elapsedMs: number; lifeMs: number;
  }[];
};

const state: HudViewModel = {
  displayedExp: ZERO,
  displayedLevel: 1,
  displayedCoins: ZERO,
  displayedShards: ZERO,
  displayedCores: ZERO,
  collectionGlowStartedAt: 0,
  particles: []
};

let queuedLevelUps = 0;

export function getAndClearQueuedLevelUps() {
  const count = queuedLevelUps;
  queuedLevelUps = 0;
  return count;
}

export function updateHudViewModel(dtMs: number, authoritative: {
  exp: BigNum, level: number, coins: BigNum, shards: BigNum, cores: BigNum
}) {
  const dtS = dtMs / 1000;
  const lerpSpeed = 7;

  if (state.displayedLevel !== authoritative.level) {
    const levelsGained = Math.max(0, authoritative.level - state.displayedLevel);
    queuedLevelUps += levelsGained;
    
    state.displayedLevel = authoritative.level;
    state.displayedExp = authoritative.exp;
    state.collectionGlowStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  // Simple instant sync for now to avoid complex BigNum lerping in UI.
  // We can add log-scale lerping later if we want smooth count-ups for massive numbers.
  state.displayedExp = authoritative.exp;
  state.displayedCoins = authoritative.coins;
  state.displayedShards = authoritative.shards;
  state.displayedCores = authoritative.cores;
}

export function getHudViewModel() {
  return state;
}

export function syncHudInstantly(authoritative: {
  exp: BigNum, level: number, coins: BigNum, shards: BigNum, cores: BigNum
}) {
  state.displayedLevel = authoritative.level;
  state.displayedExp = authoritative.exp;
  state.displayedCoins = authoritative.coins;
  state.displayedShards = authoritative.shards;
  state.displayedCores = authoritative.cores;
}
