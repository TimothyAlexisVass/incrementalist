import { normalizeCardPickSession } from './games/card-pick/index.js';

const MS_PER_DAY = 86_400_000;

export const DAILY_BONUS_SLOT_MS = 12 * 60 * 60 * 1000;
export const DAILY_BONUS_ROTATION_SLOT_COUNT = 15;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(toFiniteNumber(value, fallback)));
}

export function getUtcDayIndex(now = Date.now()) {
  return Math.floor(toFiniteNumber(now, Date.now()) / MS_PER_DAY);
}

export function getUtcBoundaryStart(now = Date.now()) {
  const timestamp = toFiniteNumber(now, Date.now());
  return Math.floor(timestamp / DAILY_BONUS_SLOT_MS) * DAILY_BONUS_SLOT_MS;
}

export function getBoundaryIndex(rotationAnchorUtc, now = Date.now()) {
  const anchor = toFiniteNumber(rotationAnchorUtc, getUtcBoundaryStart(now));
  const elapsed = toFiniteNumber(now, Date.now()) - anchor;
  return Math.max(0, Math.floor(elapsed / DAILY_BONUS_SLOT_MS));
}

export function createDailyBonusState(now = Date.now()) {
  const rotationAnchorUtc = getUtcBoundaryStart(now);

  return {
    dailyTokens: 1,
    specialTokens: 0,
    rotationAnchorUtc,
    lastTokenBoundaryIndex: getBoundaryIndex(rotationAnchorUtc, now),
    streak: 0,
    lastPlayedUtcDay: null,
    totalGamesPlayed: 0,
    rewardsReceived: 0,
    rewardCounts: createRewardCounts(),
    checklistEntryIndexes: createChecklistEntryIndexes(),
    cardPickSession: null,
    lastResult: null
  };
}

export function normalizeDailyBonusState(data, now = Date.now()) {
  const base = createDailyBonusState(now);
  if (!isRecord(data)) {
    return base;
  }

  const rotationAnchorUtc = normalizeRotationAnchor(data.rotationAnchorUtc, base.rotationAnchorUtc, now);
  const rewardCounts = normalizeRewardCounts(data.rewardCounts);
  const lastPlayedUtcDay = data.lastPlayedUtcDay === null || data.lastPlayedUtcDay === undefined
    ? null
    : toNonNegativeInteger(data.lastPlayedUtcDay, 0);

  return {
    dailyTokens: toNonNegativeInteger(data.dailyTokens, base.dailyTokens),
    specialTokens: toNonNegativeInteger(data.specialTokens, base.specialTokens),
    rotationAnchorUtc,
    lastTokenBoundaryIndex: toNonNegativeInteger(
      data.lastTokenBoundaryIndex,
      getBoundaryIndex(rotationAnchorUtc, now)
    ),
    streak: toNonNegativeInteger(data.streak, base.streak),
    lastPlayedUtcDay,
    totalGamesPlayed: toNonNegativeInteger(data.totalGamesPlayed, base.totalGamesPlayed),
    rewardsReceived: toNonNegativeInteger(data.rewardsReceived, base.rewardsReceived),
    rewardCounts,
    checklistEntryIndexes: normalizeChecklistEntryIndexes(data.checklistEntryIndexes),
    cardPickSession: normalizeCardPickSession(data.cardPickSession),
    lastResult: normalizeLastResult(data.lastResult)
  };
}

export function refreshDailyBonusState(dailyBonusState, now = Date.now()) {
  if (!isRecord(dailyBonusState)) {
    return { didGrantToken: false, rotation: getDailyBonusRotation(createDailyBonusState(now), now) };
  }

  const rotation = getDailyBonusRotation(dailyBonusState, now);
  const previousBoundaryIndex = toNonNegativeInteger(
    dailyBonusState.lastTokenBoundaryIndex,
    rotation.boundaryIndex
  );

  if (rotation.boundaryIndex <= previousBoundaryIndex) {
    dailyBonusState.lastTokenBoundaryIndex = previousBoundaryIndex;
    return { didGrantToken: false, rotation };
  }

  const hadToken = getSpendableBonusTokenCount(dailyBonusState) > 0;
  if (!hadToken) {
    dailyBonusState.dailyTokens = 1;
  }

  dailyBonusState.lastTokenBoundaryIndex = rotation.boundaryIndex;
  return { didGrantToken: !hadToken, rotation };
}

export function getDailyBonusRotation(dailyBonusState, now = Date.now()) {
  const anchor = normalizeRotationAnchor(
    dailyBonusState?.rotationAnchorUtc,
    getUtcBoundaryStart(now),
    now
  );
  const boundaryIndex = getBoundaryIndex(anchor, now);
  const activeSlot = (boundaryIndex % DAILY_BONUS_ROTATION_SLOT_COUNT) + 1;
  const nextSlot = (activeSlot % DAILY_BONUS_ROTATION_SLOT_COUNT) + 1;

  return {
    rotationAnchorUtc: anchor,
    boundaryIndex,
    activeSlot,
    nextSlot,
    nextChangeAt: anchor + ((boundaryIndex + 1) * DAILY_BONUS_SLOT_MS)
  };
}

export function getSpendableBonusTokenCount(dailyBonusState) {
  return toNonNegativeInteger(dailyBonusState?.dailyTokens, 0)
    + toNonNegativeInteger(dailyBonusState?.specialTokens, 0);
}

export function spendBonusToken(dailyBonusState) {
  if (toNonNegativeInteger(dailyBonusState.dailyTokens, 0) > 0) {
    dailyBonusState.dailyTokens -= 1;
    return 'daily';
  }

  if (toNonNegativeInteger(dailyBonusState.specialTokens, 0) > 0) {
    dailyBonusState.specialTokens -= 1;
    return 'special';
  }

  return null;
}

export function advanceDailyBonusStreak(dailyBonusState, now = Date.now()) {
  const playedDay = getUtcDayIndex(now);
  const previousDay = Number.isInteger(dailyBonusState.lastPlayedUtcDay)
    ? dailyBonusState.lastPlayedUtcDay
    : null;
  const streakBefore = toNonNegativeInteger(dailyBonusState.streak, 0);
  let nextStreak = streakBefore;
  let streakBroken = false;
  let streakImproved = false;

  if (previousDay === playedDay) {
    return {
      streakBefore,
      streakAfter: nextStreak,
      streakBroken,
      streakImproved
    };
  }

  if (previousDay !== null && playedDay > previousDay + 1) {
    nextStreak = Math.max(0, nextStreak - 3);
    streakBroken = true;
  }

  if (previousDay === null || playedDay > previousDay) {
    nextStreak += 1;
    streakImproved = true;
    dailyBonusState.lastPlayedUtcDay = playedDay;
  }

  dailyBonusState.streak = nextStreak;

  return {
    streakBefore,
    streakAfter: nextStreak,
    streakBroken,
    streakImproved
  };
}

export function createRewardCounts() {
  return {
    tier_1: 0,
    tier_2: 0,
    tier_3: 0,
    tier_4: 0,
    tier_5: 0,
    tier_6: 0,
    tier_7: 0
  };
}

export function createChecklistEntryIndexes() {
  return {
    resource: 0,
    item: 0
  };
}

function normalizeRotationAnchor(value, fallback, now) {
  const parsed = toFiniteNumber(value, fallback);
  if (parsed > 0) {
    return getUtcBoundaryStart(parsed);
  }

  return getUtcBoundaryStart(now);
}

function normalizeRewardCounts(source) {
  const counts = createRewardCounts();
  if (!isRecord(source)) {
    return counts;
  }

  for (const tierId of Object.keys(counts)) {
    counts[tierId] = toNonNegativeInteger(source[tierId], 0);
  }

  return counts;
}

function normalizeChecklistEntryIndexes(source) {
  const indexes = createChecklistEntryIndexes();
  if (!isRecord(source)) {
    return indexes;
  }

  for (const key of Object.keys(indexes)) {
    indexes[key] = toNonNegativeInteger(source[key], 0) % 15;
  }

  return indexes;
}

function normalizeLastResult(source) {
  if (!isRecord(source)) {
    return null;
  }

  const rewardId = typeof source.rewardId === 'string' ? source.rewardId : '';
  if (!Object.hasOwn(createRewardCounts(), rewardId)) {
    return null;
  }

  return {
    gameId: typeof source.gameId === 'string' ? source.gameId : 'chest_draw',
    slot: toNonNegativeInteger(source.slot, 1),
    rewardId,
    rarity: typeof source.rarity === 'string' ? source.rarity : rewardId,
    tier: Math.min(Math.max(toNonNegativeInteger(source.tier, 1), 1), 7),
    playedAt: toNonNegativeInteger(source.playedAt, 0),
    tokenType: source.tokenType === 'special' ? 'special' : 'daily',
    streakBefore: toNonNegativeInteger(source.streakBefore, 0),
    streakAfter: toNonNegativeInteger(source.streakAfter, 0),
    entryNumber: source.entryNumber === null || source.entryNumber === undefined
      ? null
      : toNonNegativeInteger(source.entryNumber, 0),
    completedCountAfter: source.completedCountAfter === null || source.completedCountAfter === undefined
      ? null
      : toNonNegativeInteger(source.completedCountAfter, 0),
    cycleCompleted: Boolean(source.cycleCompleted)
  };
}
