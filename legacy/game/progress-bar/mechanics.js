import {
  BASE_IDLE_MODE_OFF_FILL_RATE,
  BASE_IDLE_MODE_ON_FILL_RATE,
  LATE_NEW_PLAYER_BONUS_FILL_MULTIPLIER,
  NEW_PLAYER_BONUS_FILL_BONUS,
  NEW_PLAYER_BONUS_FILL_MULTIPLIER,
  NEW_PLAYER_BONUS_WINDOW_MS
} from '../config.js';
import { applyLevelUps, ensureFirstPlayedAt } from '../progression.js';
import { SISU_BASE_MAX } from '../sisu/levels.js';
import { SISU_MIN_MULTIPLIER } from '../sisu/state.js';

export function getProgressBarFillRate(state, now = Date.now()) {
  const sisuMultiplier = Math.max(
    SISU_MIN_MULTIPLIER,
    Number(state.progressBar.sisu) || SISU_MIN_MULTIPLIER
  );
  const baseRate = (state.idleMode ? BASE_IDLE_MODE_ON_FILL_RATE : BASE_IDLE_MODE_OFF_FILL_RATE) * sisuMultiplier;

  if (state.idleMode) {
    return baseRate;
  }

  const gameAgeMs = now - ensureFirstPlayedAt(state, now);

  if (gameAgeMs < NEW_PLAYER_BONUS_WINDOW_MS) {
    return (baseRate * NEW_PLAYER_BONUS_FILL_MULTIPLIER) + NEW_PLAYER_BONUS_FILL_BONUS;
  }

  if (state.level < 35) {
    return baseRate * LATE_NEW_PLAYER_BONUS_FILL_MULTIPLIER;
  }

  return baseRate;
}

export function updateProgressBar(state, deltaTime, now = Date.now()) {
  const fillRate = getProgressBarFillRate(state, now);
  const fillAmount = fillRate * (deltaTime / 1000);

  state.progressBar.fill += fillAmount;

  if (state.progressBar.fill >= 100) {
    state.progressBar.fill = 100;
    state.canClaim = true;
  }

  return state.progressBar.fill;
}

export function claimReward(state, randomFn = Math.random) {
  if (!state.canClaim) return null;

  const rewardsClaimed = state.progressBar.rewardsClaimed;
  const sisuMultiplier = Math.max(
    SISU_MIN_MULTIPLIER,
    Number(state.progressBar.sisu) || SISU_MIN_MULTIPLIER
  );

  const levelPow = Math.pow(state.level, 0.7);
  const rewardMultiplier = state.progressBar.rewardMultiplier;

  let expBase = state.level < 10 ? state.level * 7 : (state.level < 20 ? 33 : 77);
  let expGain;
  let coinGain;
  let shardGain;
  let coreGain;

  if (state.level == 1) {
    expGain = 4;
    coinGain = 500;
    shardGain = 100;
    coreGain = 20;
  } else {
    expGain = Math.floor(expBase * sisuMultiplier * levelPow * rewardMultiplier);

    const variance = 0.8 + randomFn() * 0.4;
    coinGain = Math.floor(35 * sisuMultiplier * levelPow * rewardMultiplier * variance);
    shardGain = Math.floor((coinGain / (4 + randomFn() * 12)) * (state.idleMode ? 1 : 2));
    coreGain = (!state.idleMode && randomFn() < 0.1) ? 1 : 0;
    coreGain += (!state.idleMode && randomFn() < 0.01) ? 10 : 0;
  }

  state.exp += expGain;
  state.coins += coinGain;
  state.shards += shardGain;
  state.cores += coreGain;

  const levelUps = applyLevelUps(state);

  state.progressBar.rewardsClaimed += 1;
  state.progressBar.fill = 0;
  state.canClaim = false;
  state.justClaimed = true;

  return {
    expGain,
    coinGain,
    shardGain,
    coreGain,
    levelUps
  };
}
