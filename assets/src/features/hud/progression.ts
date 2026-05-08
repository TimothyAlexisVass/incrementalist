export function getRequiredExp(level: number): number {
  return Math.floor(10.1 * Math.pow(level, 2) + 9);
}

export function getLevelUpRewards(newLevel: number) {
  let shards = newLevel;
  let cores = Math.floor(newLevel / 10);

  if (newLevel % 1000 === 0) {
    cores = 10 * newLevel;
  }
  if (newLevel % 100 === 0) {
    shards *= 100;
    cores = newLevel;
  }

  return {
    coins: 200 * newLevel,
    shards,
    cores
  };
}

export function computeLevelUps(startLevel: number, endLevel: number) {
  const levelUps = [];

  for (let level = startLevel + 1; level <= endLevel; level++) {
    levelUps.push({
      level,
      rewards: getLevelUpRewards(level)
    });
  }

  return levelUps;
}
