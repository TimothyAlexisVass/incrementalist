export const CHEST_DRAW_GAME = Object.freeze({
  id: 'chest_draw',
  slot: 1,
  name: 'Chest Draw'
});

export const CHEST_DRAW_TIERS = Object.freeze([
  Object.freeze({
    tier: 1,
    rarity: 'Standard Chest',
    chance: 0.5,
    chanceLabel: '50%',
    rewardId: 'tier_1',
    color: '#9aa7b5'
  }),
  Object.freeze({
    tier: 2,
    rarity: 'Rare Chest',
    chance: 0.35,
    chanceLabel: '35%',
    rewardId: 'tier_2',
    color: '#56a8ff'
  }),
  Object.freeze({
    tier: 3,
    rarity: 'Remarkable Chest',
    chance: 0.1,
    chanceLabel: '10%',
    rewardId: 'tier_3',
    color: '#52df87'
  }),
  Object.freeze({
    tier: 4,
    rarity: 'Exotic Chest',
    chance: 0.04,
    chanceLabel: '4%',
    rewardId: 'tier_4',
    color: '#ba77ff'
  }),
  Object.freeze({
    tier: 5,
    rarity: 'Supreme Chest',
    chance: 0.009,
    chanceLabel: '0.9%',
    rewardId: 'tier_5',
    color: '#ffbe4d'
  }),
  Object.freeze({
    tier: 6,
    rarity: 'Ultimate Chest',
    chance: 0.0009,
    chanceLabel: '0.09%',
    rewardId: 'tier_6',
    color: '#ff5b8f'
  }),
  Object.freeze({
    tier: 7,
    rarity: 'Impossible Chest',
    chance: 0.0001,
    chanceLabel: '0.01%',
    rewardId: 'tier_7',
    color: '#ffffff'
  })
]);

const FALLBACK_TIER = CHEST_DRAW_TIERS[0];

export function getChestRollCount(streak) {
  return 1 + Math.min(Math.floor(Math.max(0, Number(streak) || 0) / 60), 2);
}

export function rollChestDraw(streak, randomFn = Math.random) {
  const rollCount = getChestRollCount(streak);
  const rolls = [];

  for (let i = 0; i < rollCount; i += 1) {
    rolls.push(rollChestTier(randomFn));
  }

  const best = rolls.reduce(
    (currentBest, roll) => (roll.tier > currentBest.tier ? roll : currentBest),
    FALLBACK_TIER
  );

  return {
    gameId: CHEST_DRAW_GAME.id,
    slot: CHEST_DRAW_GAME.slot,
    rolls,
    tier: best.tier,
    rarity: best.rarity,
    rewardId: best.rewardId
  };
}

const TIERS_BY_REWARD_ID = new Map(CHEST_DRAW_TIERS.map(tier => [tier.rewardId, tier]));

export function getChestTierByRewardId(rewardId) {
  return TIERS_BY_REWARD_ID.get(rewardId) || FALLBACK_TIER;
}

function rollChestTier(randomFn) {
  const random = Math.min(Math.max(Number(randomFn()) || 0, 0), 0.999999999);
  let cursor = 0;

  for (const tier of CHEST_DRAW_TIERS) {
    cursor += tier.chance;
    if (random < cursor) {
      return tier;
    }
  }

  return FALLBACK_TIER;
}
