export const COIN_RAIN_GAME = {
  id: 'coin_rain',
  slot: 5,
  name: 'Coin Rain'
};

const TIERS = [
  { id: 'tier_1', chance: 0.005, speedMult: 2 },
  { id: 'tier_2', chance: 0.002, speedMult: 3 },
  { id: 'tier_3', chance: 0.0008, speedMult: 4 },
  { id: 'tier_4', chance: 0.0003, speedMult: 5 },
  { id: 'tier_5', chance: 0.0001, speedMult: 6 },
  { id: 'tier_6', chance: 0.00002, speedMult: 7 },
  { id: 'tier_7', chance: 0.000005, speedMult: 9999 }
];

export function getCoinRainParameters(streak, randomFn = Math.random) {
  // randomFn returns a value 0 to 1, scale as needed for defaults
  const randTimer = randomFn() * 3 + 5; // 5 to 8
  const randWidth = randomFn() * 20 + 30; // 30 to 50
  const randSpeed = randomFn() * 200 + 100; // 100 to 300

  const timer = randTimer + Math.round((streak / 50) * 100) / 100;
  const bucketWidth = randWidth + Math.min(Math.floor(streak / 10), 30);
  const bucketSpeed = randSpeed + Math.min(streak, 200);

  return { timer, bucketWidth, bucketSpeed };
}

export function spawnCoinRainItem(randomFn = Math.random) {
  const rand = randomFn();
  let cumulativeChance = 0;

  for (const tier of TIERS) {
    cumulativeChance += tier.chance;
    if (rand <= cumulativeChance) {
      return { type: 'reward', id: tier.id, speedMult: tier.speedMult };
    }
  }

  return { type: 'coin', speedMult: 1 };
}

export function evaluateCoinRainResults(caughtItems) {
  const rewards = caughtItems.filter(item => item.type === 'reward');
  const coins = caughtItems.filter(item => item.type === 'coin');

  let bestReward = null;
  for (const reward of rewards) {
    const tierMatch = reward.id.match(/^tier_(\d+)$/);
    if (tierMatch) {
      const tierNum = parseInt(tierMatch[1], 10);
      if (!bestReward || tierNum > bestReward.tierNum) {
        bestReward = { id: reward.id, tierNum };
      }
    }
  }

  return {
    gameId: COIN_RAIN_GAME.id,
    slot: COIN_RAIN_GAME.slot,
    rewardId: bestReward ? bestReward.id : 'coin',
    rarity: bestReward ? `Tier ${bestReward.tierNum}` : 'Common',
    tier: bestReward ? bestReward.tierNum : 0,
    caughtCoins: coins.length,
    caughtRewards: rewards.length
  };
}
