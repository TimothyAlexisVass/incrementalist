export function getRequiredExp(level: number): number {
  return (level * level) * 10 + 10;
}

export function getLevelUpRewards(newLevel: number) {
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
