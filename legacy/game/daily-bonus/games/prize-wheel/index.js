const TWO_PI = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;

export const PRIZE_WHEEL_GAME = Object.freeze({
  id: 'prize_wheel',
  slot: 2,
  name: 'Prize Wheel'
});

const RAW_PRIZE_WHEEL_SLICES = Object.freeze([
  Object.freeze({
    tier: 1,
    rarity: 'Common Hit',
    shortLabel: 'Common',
    chance: 0.5,
    chanceLabel: '50%',
    rewardId: 'tier_1',
    color: '#9aa7b5'
  }),
  Object.freeze({
    tier: 2,
    rarity: 'Small Hit',
    shortLabel: 'Small',
    chance: 0.3,
    chanceLabel: '30%',
    rewardId: 'tier_2',
    color: '#56a8ff'
  }),
  Object.freeze({
    tier: 3,
    rarity: 'Medium Hit',
    shortLabel: 'Medium',
    chance: 0.12,
    chanceLabel: '12%',
    rewardId: 'tier_3',
    color: '#52df87'
  }),
  Object.freeze({
    tier: 4,
    rarity: 'Large Hit',
    shortLabel: 'Large',
    chance: 0.05,
    chanceLabel: '5%',
    rewardId: 'tier_4',
    color: '#ba77ff'
  }),
  Object.freeze({
    tier: 5,
    rarity: 'Lucky Hit',
    shortLabel: 'Lucky',
    chance: 0.02,
    chanceLabel: '2%',
    rewardId: 'tier_5',
    color: '#ffbe4d'
  }),
  Object.freeze({
    tier: 6,
    rarity: 'Bonus Hit',
    shortLabel: 'Bonus',
    chance: 0.0097,
    chanceLabel: '0.97%',
    rewardId: 'tier_6',
    color: '#ff5b8f'
  }),
  Object.freeze({
    tier: 7,
    rarity: 'Jackpot',
    shortLabel: 'Jackpot',
    chance: 0.0003,
    chanceLabel: '0.03%',
    rewardId: 'tier_7',
    color: '#ffffff'
  })
]);

export const PRIZE_WHEEL_SLICES = Object.freeze(createPrizeWheelSlices());

const FALLBACK_SLICE = PRIZE_WHEEL_SLICES[0];

export function getPrizeWheelSpinCount(streak) {
  return 1 + Math.min(Math.floor(Math.max(0, Number(streak) || 0) / 30), 2);
}

export function spinPrizeWheel(streak, randomFn = Math.random) {
  const spinCount = getPrizeWheelSpinCount(streak);
  const spins = [];
  let previousTargetRotation = 0;

  for (let i = 0; i < spinCount; i += 1) {
    const spin = rollPrizeWheelSlice(randomFn);
    const visualRandom = toRandomUnit(randomFn());
    const targetRotation = getTargetRotation(
      spin.landingAngle,
      previousTargetRotation,
      i,
      visualRandom
    );

    previousTargetRotation = targetRotation;
    spins.push(Object.freeze({
      ...spin,
      spinNumber: i + 1,
      targetRotation
    }));
  }

  const best = spins.reduce(
    (currentBest, spin) => (spin.tier > currentBest.tier ? spin : currentBest),
    FALLBACK_SLICE
  );

  return {
    gameId: PRIZE_WHEEL_GAME.id,
    slot: PRIZE_WHEEL_GAME.slot,
    spins,
    rolls: spins,
    tier: best.tier,
    rarity: best.rarity,
    rewardId: best.rewardId
  };
}

export function getPrizeWheelSliceByRewardId(rewardId) {
  return PRIZE_WHEEL_SLICES.find((slice) => slice.rewardId === rewardId) || FALLBACK_SLICE;
}

function createPrizeWheelSlices() {
  let chanceCursor = 0;

  return RAW_PRIZE_WHEEL_SLICES.map((slice) => {
    const startRatio = chanceCursor;
    chanceCursor += slice.chance;
    const endRatio = chanceCursor;

    return Object.freeze({
      ...slice,
      startRatio,
      endRatio,
      startAngle: POINTER_ANGLE + (startRatio * TWO_PI),
      endAngle: POINTER_ANGLE + (endRatio * TWO_PI)
    });
  });
}

function rollPrizeWheelSlice(randomFn) {
  const random = toRandomUnit(randomFn());
  let chanceCursor = 0;

  for (const slice of PRIZE_WHEEL_SLICES) {
    const nextChanceCursor = chanceCursor + slice.chance;
    if (random < nextChanceCursor) {
      const rawWithinSlice = slice.chance > 0
        ? (random - chanceCursor) / slice.chance
        : 0.5;
      const withinSlice = 0.18 + (clamp01(rawWithinSlice) * 0.64);

      return {
        ...slice,
        landingAngle: slice.startAngle + ((slice.endAngle - slice.startAngle) * withinSlice)
      };
    }
    chanceCursor = nextChanceCursor;
  }

  return {
    ...FALLBACK_SLICE,
    landingAngle: (FALLBACK_SLICE.startAngle + FALLBACK_SLICE.endAngle) / 2
  };
}

function getTargetRotation(landingAngle, previousTargetRotation, spinIndex, visualRandom) {
  const minimumTurns = 4 + spinIndex + Math.floor(visualRandom * 2);
  let targetRotation = POINTER_ANGLE - landingAngle;

  while (targetRotation < previousTargetRotation + (minimumTurns * TWO_PI)) {
    targetRotation += TWO_PI;
  }

  return targetRotation;
}

function toRandomUnit(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 0.999999999);
}

function clamp01(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 1);
}
