import { toFiniteNumber } from '../format.js';

export const ACHIEVEMENT_DEFS = {
  tutorial_graduated: {
    name: 'Graduated',
    stars: 20.0,
    condition: (state) => toFiniteNumber(state.achievements?.tutorialTasksCompleted, 0) >= 15
  },
  level_10: {
    name: 'Newbie Incrementalist',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.level, 1) >= 10
  },
  level_20: {
    name: 'Good Incrementalist',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.level, 1) >= 20
  },
  level_40: {
    name: 'Better Incrementalist',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.level, 1) >= 40
  },
  rewards_50: {
    name: 'First Rewards',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.progressBar?.rewardsClaimed, 0) >= 50
  },
  rewards_250: {
    name: 'More Rewards',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.progressBar?.rewardsClaimed, 0) >= 250
  },
  rewards_500: {
    name: 'Moar Rewards',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.progressBar?.rewardsClaimed, 0) >= 500
  },
  rewards_1000: {
    name: 'Even More Rewards',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.progressBar?.rewardsClaimed, 0) >= 1000
  },
  coins_50000: {
    name: 'High Roller',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.coins, 0) >= 50000
  },
  coins_100000: {
    name: 'New Digit Unlocked!',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.coins, 0) >= 100000
  },
  shards_2500: {
    name: 'First Shards',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.shards, 0) >= 2500
  },
  cores_100: {
    name: 'First Cores',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.cores, 0) >= 100
  },
  screens_viewed_stats: {
    name: 'This Screen Is Boring',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.achievements?.screenViews?.stats, 0) >= 1
  },
  screens_viewed_quests: {
    name: 'More Tasks, YAY!',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.achievements?.screenViews?.quests, 0) >= 1
  },
  screens_viewed_achievements: {
    name: 'This is An Achievement!',
    stars: 0.05,
    condition: (state) => toFiniteNumber(state.achievements?.screenViews?.achievements, 0) >= 1
  }
};
