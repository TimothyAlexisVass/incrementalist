import { BigNum, add, compare, fromNumber, pow, mul, toNumber } from "../../../core/bignum";

const SMALL_REQUIRED_EXP_THRESHOLD = fromNumber(1000);

export function getRequiredExp(level: number): BigNum {
  // 10.1 * level^2 + 9
  const base = fromNumber(level);
  const term1 = mul(fromNumber(10.1), pow(base, 2));
  return snapSmallRequiredExp(add(term1, fromNumber(9)));
}

function snapSmallRequiredExp(requiredExp: BigNum): BigNum {
  // Keep early-game requirements on clean tens so the EXP display and claim math stay whole-numbered.
  if (compare(requiredExp, SMALL_REQUIRED_EXP_THRESHOLD) < 0) {
    return fromNumber(Math.round(toNumber(requiredExp) / 10) * 10);
  }

  return requiredExp;
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
