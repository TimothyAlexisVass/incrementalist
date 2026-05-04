import {
  SISU_MIN_MULTIPLIER,
  SISU_REFILL_TIERS,
  updateSisuVisualState
} from './state.js';
import { SISU_BASE_MAX, SISU_PER_LEVEL, MAX_SISU_UPGRADE_LEVEL, UPGRADE_COST } from './levels.js';

// TODO: It should be possible to upgrade sisus to lower diminishment
// blue should be possible to upgrade at -0.03 each level until diminshment is 2
// yellow should be possible to upgrade at -0.04 each level until diminishment is 3
// purple should be possible to upgrade at -0.06 each level until diminishment is 4
const SISU_DIMINISHMENT_BY_TIER = {
  blue: 5,
  yellow: 7,
  purple: 10
};

const SISU_DIMINISHMENT_REDUCTION_FACTOR_PER_SECOND = 0.98;

export function getSisuDiminishmentForTier(tierId = 'blue') {
  return SISU_DIMINISHMENT_BY_TIER[tierId] ?? SISU_DIMINISHMENT_BY_TIER.blue;
}

export function getMaxSisuUpgradeCost(level) {
  const normalizedLevel = normalizeUpgradeLevel(level);
  if (normalizedLevel <= 0) {
    return 0;
  }

  if (normalizedLevel > MAX_SISU_UPGRADE_LEVEL) {
    return null;
  }

  return UPGRADE_COST[normalizedLevel] ?? null;
}

export function getMaxSisuForLevel(level) {
  const normalizedLevel = Math.min(MAX_SISU_UPGRADE_LEVEL, normalizeUpgradeLevel(level));
  return SISU_BASE_MAX + (normalizedLevel * SISU_PER_LEVEL);
}

export function canPurchaseMaxSisuUpgrade(state) {
  const currentLevel = state.sisu?.maxUpgradeLevel || 0;
  if (currentLevel >= MAX_SISU_UPGRADE_LEVEL) {
    return { canPurchase: false, reason: 'MAX', cost: 0 };
  }

  const cost = getMaxSisuUpgradeCost(currentLevel + 1);
  if (!Number.isFinite(cost) || cost <= 0) {
    return { canPurchase: false, reason: 'Upgrade data missing', cost: 0 };
  }

  if (state.shards < cost) {
    return { canPurchase: false, reason: 'Not enough shards', cost };
  }

  return { canPurchase: true, reason: null, cost };
}

export function purchaseMaxSisuUpgrade(state) {
  const purchaseCheck = canPurchaseMaxSisuUpgrade(state);
  if (!purchaseCheck.canPurchase) {
    return { success: false, reason: purchaseCheck.reason };
  }

  state.shards -= purchaseCheck.cost;
  state.sisu.maxUpgradeLevel = Math.min(MAX_SISU_UPGRADE_LEVEL, state.sisu.maxUpgradeLevel + 1);
  state.sisu.maxBasic = getMaxSisuForLevel(state.sisu.maxUpgradeLevel);

  return { success: true, reason: null };
}

export function getSisuTierTarget(state, tierId) {
  const tier = SISU_REFILL_TIERS[tierId] || SISU_REFILL_TIERS.blue;
  const blueMax = state.sisu?.maxBasic || SISU_BASE_MAX;
  return Math.round(blueMax * tier.multiplier * 100) / 100;
}

export function getSisuEffectiveMax(state) {
  return getSisuTierTarget(state, 'purple');
}

export function refillSisu(state, tierId = 'blue') {
  if (!state.progressBar || !state.sisu) {
    return { success: false, reason: 'Sisu is unavailable' };
  }

  const normalizedTierId = SISU_REFILL_TIERS[tierId] ? tierId : 'blue';

  const target = getSisuTierTarget(state, normalizedTierId);
  const effectiveMax = getSisuEffectiveMax(state);
  const currentSisu = Math.max(
    SISU_MIN_MULTIPLIER,
    Number(state.progressBar.sisu) || SISU_MIN_MULTIPLIER
  );

  if (currentSisu >= target) {
    return {
      success: false,
      reason: 'Sisu is already higher',
      target,
      current: currentSisu,
      tier: SISU_REFILL_TIERS[normalizedTierId]
    };
  }

  const nextSisu = Math.min(effectiveMax, Math.max(currentSisu, target));

  state.progressBar.sisu = nextSisu;
  state.sisu.current = nextSisu;
  state.sisu.diminishmentPerSecond = getSisuDiminishmentForTier(normalizedTierId);

  return {
    success: true,
    target,
    tier: SISU_REFILL_TIERS[normalizedTierId]
  };
}

export function freeRefillSisu(state) {
  return refillSisu(state, 'blue');
}

export function initializeSisuGenerator(state) {
  if (!state.sisu || !state.progressBar) {
    return;
  }

  state.sisu.maxBasic = getMaxSisuForLevel(state.sisu.maxUpgradeLevel || 0);
  state.progressBar.sisu = state.sisu.maxBasic;
  state.sisu.current = state.sisu.maxBasic;
  state.sisu.decayTickRemainderMs = 0;
  state.sisu.diminishmentPerSecond = getSisuDiminishmentForTier('blue');
}

export function updateSisuDecay(state, deltaTime) {
  if (!state.features?.sisuGeneratorPurchased) {
    return;
  }

  if (!state.sisu) {
    state.sisu = {};
  }

  if (!state.progressBar) {
    return;
  }

  const elapsedMs = Math.max(0, Number(deltaTime) || 0);
  const accumulatedMs = (Number(state.sisu.decayTickRemainderMs) || 0) + elapsedMs;
  const wholeSeconds = Math.floor(accumulatedMs / 1000);

  if (wholeSeconds <= 0) {
    state.sisu.decayTickRemainderMs = accumulatedMs;
    updateSisuVisualState(state, elapsedMs);
    return;
  }

  const effectiveMax = getSisuEffectiveMax(state);

  let sisu = Math.max(
    SISU_MIN_MULTIPLIER,
    Number(state.progressBar.sisu) || SISU_MIN_MULTIPLIER
  );

  let diminishment = Math.max(
    0,
    Number(state.sisu.diminishmentPerSecond) || getSisuDiminishmentForTier('blue')
  );

  for (let i = 0; i < wholeSeconds; i += 1) {
    sisu *= 1 - (diminishment / 100);
    diminishment *= SISU_DIMINISHMENT_REDUCTION_FACTOR_PER_SECOND;
  }

  state.progressBar.sisu = Math.max(SISU_MIN_MULTIPLIER, sisu);
  state.progressBar.sisu = Math.min(effectiveMax, state.progressBar.sisu);

  state.sisu.current = state.progressBar.sisu;
  state.sisu.diminishmentPerSecond = diminishment;
  state.sisu.decayTickRemainderMs = accumulatedMs - (wholeSeconds * 1000);
  updateSisuVisualState(state, elapsedMs);
}

function normalizeUpgradeLevel(level) {
  const parsed = Math.floor(Number(level) || 0);
  return Math.max(0, parsed);
}
