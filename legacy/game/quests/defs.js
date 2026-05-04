export const QUEST_RANK_LABELS = ['-', 'C', 'B', 'A', 'S'];
export const QUEST_RANK_POINTS = [0, 1, 3, 6, 10];

export const MAIN_QUESTS = {
  level_up: {
    name: '[Level] Level Up!',
    ranks: {
      1: { requirement: 50, reward: 50 },
      2: { requirement: 150, reward: 150 },
      3: { requirement: 300, reward: 300 },
      4: { requirement: 500, reward: 500 }
    }
  },
  achievements: {
    name: '[Achievement] Achievements!',
    ranks: {
      1: { requirement: 100, reward: 2500 },
      2: { requirement: 400, reward: 7500 },
      3: { requirement: 550, reward: 15000 },
      4: { requirement: 630, reward: 25000 }
    }
  },
  quest_c_rank: {
    name: '[Quest] C-Rank',
    ranks: {
      1: { requirement: 30, reward: 500 },
      2: { requirement: 60, reward: 1500 },
      3: { requirement: 90, reward: 3000 },
      4: { requirement: 120, reward: 5000 }
    }
  },
  money_coins: {
    name: '[Money] Coins',
    ranks: {
      1: { requirement: 100000, reward: 250 },
      2: { requirement: 15000000, reward: 750 },
      3: { requirement: 7500000000, reward: 1500 },
      4: { requirement: 999999999999, reward: 2500 }
    }
  },
  money_shards: {
    name: '[Money] Shards',
    ranks: {
      1: { requirement: 3000, reward: 250 },
      2: { requirement: 250000, reward: 750 },
      3: { requirement: 10000000, reward: 1500 },
      4: { requirement: 999999999, reward: 2500 }
    }
  },
  money_cores: {
    name: '[Money] Cores',
    ranks: {
      1: { requirement: 300, reward: 500 },
      2: { requirement: 7500, reward: 1500 },
      3: { requirement: 50000, reward: 3000 },
      4: { requirement: 999999, reward: 5000 }
    }
  },
  progress_claim: {
    name: '[Progress] Claim Rewards!',
    ranks: {
      1: { requirement: 15, reward: 100 },
      2: { requirement: 1500, reward: 300 },
      3: { requirement: 75000, reward: 600 },
      4: { requirement: 1500000, reward: 1000 }
    }
  }
};

export const DAILY_QUESTS = {
  attendance: {
    name: 'Attendance Gift',
    ranks: {
      1: { requirement: 2, reward: 5 },
      2: { requirement: 10, reward: 15 },
      3: { requirement: 50, reward: 30 },
      4: { requirement: 100, reward: 50 }
    }
  },
  level_up_daily: {
    name: 'Level Up Gift',
    ranks: {
      1: { requirement: 2, reward: 5 },
      2: { requirement: 1000, reward: 15 },
      3: { requirement: 5000, reward: 30 },
      4: { requirement: 9001, reward: 50 }
    }
  }
};
