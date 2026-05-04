import { refillSisu } from './sisu/mechanics.js';

export function updateRequiredExp(state) {
  state.requiredExp = (state.level * state.level) * 10 + 10;
  return state.requiredExp;
}

export function ensureFirstPlayedAt(state, now = Date.now()) {
  if (!Number.isFinite(state.firstPlayedAt) || state.firstPlayedAt <= 0) {
    state.firstPlayedAt = now;
  }

  return state.firstPlayedAt;
}

export function getLevelUpRewards(newLevel) {
  let shards = newLevel;
  let cores = 0;

  if (newLevel % 1000 === 0) {
    cores = newLevel;
  } else if (newLevel % 100 === 0) {
    shards *= 10;
  }

  return {
    coins: 200 * newLevel,
    shards,
    cores
  };
}

export function applyLevelUps(state) {
  updateRequiredExp(state);

  const levelUps = [];

  while (state.exp >= state.requiredExp) {
    state.exp -= state.requiredExp;
    state.level += 1;

    const rewards = getLevelUpRewards(state.level);
    state.coins += rewards.coins;
    state.shards += rewards.shards;
    state.cores += rewards.cores;

    if (state.features?.sisuGeneratorPurchased) {
      refillSisu(state, 'yellow');
    }

    updateRequiredExp(state);
    levelUps.push({
      level: state.level,
      rewards
    });
  }

  return levelUps;
}
