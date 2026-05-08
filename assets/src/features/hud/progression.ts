import { BigNum, fromNumber, pow, mul, add, big } from "../../core/bignum";

export function getRequiredExp(level: number): BigNum {
  // 10.1 * level^2 + 9
  const base = fromNumber(level);
  const term1 = mul(fromNumber(10.1), pow(base, 2));
  return add(term1, fromNumber(9));
}

export function getLevelUpRewards(newLevel: number) {
  let shards = fromNumber(newLevel);
  let cores = fromNumber(Math.floor(newLevel / 10));

  if (newLevel % 1000 === 0) {
    cores = mul(fromNumber(10), fromNumber(newLevel));
  }
  if (newLevel % 100 === 0) {
    shards = mul(shards, fromNumber(100));
    cores = fromNumber(newLevel);
  }

  return {
    coins: mul(fromNumber(200), fromNumber(newLevel)),
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

