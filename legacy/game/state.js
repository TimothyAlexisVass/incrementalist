import { createAchievementsState } from './achievements/evaluate.js';
import { createSisuState } from './sisu/state.js';
import { createQuestsState } from './quests/state.js';
import { createDailyBonusState } from './daily-bonus/state.js';
import { AREAS } from './areas/list.js';

export function createGlobalOptionsState() {
  return {
    lastSavefile: 0
  };
}

export function createProgressBarState() {
  return {
    fill: 0,
    sisu: 1,
    rewardMultiplier: 1.0,
    rewardsClaimed: 0
  };
}

export function createGameState() {
  return {
    area: 'sage',

    level: 1,
    exp: 0,
    requiredExp: 20,
    coins: 0,
    shards: 0,
    cores: 0,

    progressBar: createProgressBarState(),
    achievements: createAchievementsState(),
    quests: createQuestsState(),
    dailyBonus: createDailyBonusState(),

    lastInputTime: 0,
    canClaim: false,
    justClaimed: false,
    firstPlayedAt: 0,
    idleMode: false,
    fileIndex: 0,

    features: {
      idleModePurchased: false,
      worldMapUnlocked: false,
      sisuGeneratorPurchased: false,
      bonusTimePurchased: false
    },

    sisu: createSisuState()
  };
}
