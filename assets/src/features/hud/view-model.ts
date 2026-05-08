import { lerp } from "../../utils";

export type HudViewModel = {
  displayedExp: number;
  displayedLevel: number;
  displayedCoins: number;
  displayedShards: number;
  displayedCores: number;
  
  // Level up visual state
  collectionGlowStartedAt: number;
  particles: {
    x: number; y: number; vx: number; vy: number; drag: number;
    radius: number; lineWidth: number; color: string; gravity: number;
    elapsedMs: number; lifeMs: number;
  }[];
};

const state: HudViewModel = {
  displayedExp: 0,
  displayedLevel: 1,
  displayedCoins: 0,
  displayedShards: 0,
  displayedCores: 0,
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
  exp: number, level: number, coins: number, shards: number, cores: number
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

  state.displayedExp = lerp(state.displayedExp, authoritative.exp, dtS * lerpSpeed);
  state.displayedCoins = lerp(state.displayedCoins, authoritative.coins, dtS * lerpSpeed);
  state.displayedShards = lerp(state.displayedShards, authoritative.shards, dtS * lerpSpeed);
  state.displayedCores = lerp(state.displayedCores, authoritative.cores, dtS * lerpSpeed);

  if (Math.abs(state.displayedCoins - authoritative.coins) < 0.5) state.displayedCoins = authoritative.coins;
  if (Math.abs(state.displayedShards - authoritative.shards) < 0.5) state.displayedShards = authoritative.shards;
  if (Math.abs(state.displayedCores - authoritative.cores) < 0.5) state.displayedCores = authoritative.cores;
  if (Math.abs(state.displayedExp - authoritative.exp) < 0.5) state.displayedExp = authoritative.exp;
}

export function getHudViewModel() {
  return state;
}

export function syncHudInstantly(authoritative: {
  exp: number, level: number, coins: number, shards: number, cores: number
}) {
  state.displayedLevel = authoritative.level;
  state.displayedExp = authoritative.exp;
  state.displayedCoins = authoritative.coins;
  state.displayedShards = authoritative.shards;
  state.displayedCores = authoritative.cores;
}
