export const CARD_PICK_GAME = Object.freeze({
  id: 'card_pick',
  slot: 4,
  name: 'Card Pick'
});

export const CARD_PICK_BOARD_COLS = 6;
export const CARD_PICK_BOARD_ROWS = 6;
export const CARD_PICK_CARD_COUNT = CARD_PICK_BOARD_COLS * CARD_PICK_BOARD_ROWS;
export const CARD_PICK_INITIAL_PICK_MIN = 2;
export const CARD_PICK_INITIAL_PICK_MAX = 9;
export const CARD_PICK_INITIAL_PICK_STREAK_INTERVAL = 7;
export const CARD_PICK_INITIAL_BONUS_CHANCE_BASE = 0.2;
export const CARD_PICK_INITIAL_BONUS_CHANCE_STREAK_CAP = 77;
export const CARD_PICK_SECOND_BONUS_CHANCE = 0.1;
export const CARD_PICK_CONSECUTIVE_BONUS_CHANCE = 0.05;

export const CARD_PICK_SESSION_STATUS = Object.freeze({
  SELECTING: 'selecting',
  SELECTION_CONFIRMED: 'selection_confirmed',
  SELECTED_REVEALED: 'selected_revealed',
  MISSED_REVEALED: 'missed_revealed',
  COMPLETE: 'complete'
});

export const CARD_PICK_TIERS = Object.freeze([
  { tier: 1, rarity: 'Common Card', chance: 0.613, rewardId: 'tier_1', color: '#9aa7b5' },
  { tier: 2, rarity: 'Rare Card', chance: 0.20, rewardId: 'tier_2', color: '#56a8ff' },
  { tier: 3, rarity: 'Elite Card', chance: 0.10, rewardId: 'tier_3', color: '#52df87' },
  { tier: 4, rarity: 'Excellent Card', chance: 0.05, rewardId: 'tier_4', color: '#ba77ff' },
  { tier: 5, rarity: 'Unique Card', chance: 0.025, rewardId: 'tier_5', color: '#ffbe4d' },
  { tier: 6, rarity: 'Exotic Card', chance: 0.01, rewardId: 'tier_6', color: '#ff5b8f' },
  { tier: 7, rarity: 'Ultimate Card', chance: 0.002, rewardId: 'tier_7', color: '#ffffff' }
]);

const FALLBACK_TIER = CARD_PICK_TIERS[0];
const CARD_PICK_SESSION_STATUSES = new Set(Object.values(CARD_PICK_SESSION_STATUS));
const CARD_PICK_REWARD_IDS = new Set(CARD_PICK_TIERS.map((tier) => tier.rewardId));

export function getCardPickCount(streak) {
  const normalizedStreak = Math.max(0, Number(streak) || 0);
  const bonusPicks = Math.min(
    CARD_PICK_INITIAL_PICK_MAX - CARD_PICK_INITIAL_PICK_MIN,
    Math.floor(normalizedStreak / CARD_PICK_INITIAL_PICK_STREAK_INTERVAL)
  );

  return CARD_PICK_INITIAL_PICK_MIN + bonusPicks;
}

export function rollCardPick(streak, randomFn = Math.random) {
  return createCardPickSession({ streakBefore: streak, randomFn });
}

export function createCardPickSession(options = {}) {
  const {
    randomFn = Math.random,
    streakBefore = 0,
    tokenType = null,
    now = Date.now()
  } = options;
  const normalizedStreak = toNonNegativeInteger(streakBefore);
  const initialPickCount = getCardPickCount(normalizedStreak);
  const session = {
    gameId: CARD_PICK_GAME.id,
    slot: CARD_PICK_GAME.slot,
    status: CARD_PICK_SESSION_STATUS.SELECTING,
    startedAt: toTimestamp(now),
    completedAt: null,
    tokenType: tokenType === 'special' ? 'special' : tokenType === 'daily' ? 'daily' : null,
    streakBefore: normalizedStreak,
    initialPickCount,
    requiredPickCount: initialPickCount,
    currentPhaseIndex: 0,
    phases: [
      createCardPickPhase({
        type: 'initial',
        pickCount: initialPickCount,
        multiplier: 1
      })
    ],
    initialBoard: createCardPickBoard(randomFn),
    selectedCardIndexes: [],
    resolvedCardIndexes: [],
    missedCardIndexes: [],
    rolls: [],
    bonusRolls: [],
    tier: null,
    rarity: null,
    rewardId: null
  };

  syncCardPickSession(session);
  return session;
}

export function normalizeCardPickSession(source) {
  if (!isRecord(source) || source.gameId !== CARD_PICK_GAME.id) {
    return null;
  }

  const initialBoard = Array.isArray(source.initialBoard)
    ? source.initialBoard.map(normalizeCardPickBoardCard)
    : [];
  const phases = Array.isArray(source.phases)
    ? source.phases.map(normalizeCardPickPhase).filter(Boolean)
    : [];

  if (initialBoard.length !== CARD_PICK_CARD_COUNT || phases.length <= 0) {
    return null;
  }

  const currentPhaseIndex = Math.min(
    phases.length - 1,
    toNonNegativeInteger(source.currentPhaseIndex)
  );
  const status = CARD_PICK_SESSION_STATUSES.has(source.status)
    ? source.status
    : CARD_PICK_SESSION_STATUS.SELECTING;
  const session = {
    gameId: CARD_PICK_GAME.id,
    slot: CARD_PICK_GAME.slot,
    status,
    startedAt: toTimestamp(source.startedAt),
    completedAt: status === CARD_PICK_SESSION_STATUS.COMPLETE
      ? toTimestamp(source.completedAt)
      : null,
    tokenType: source.tokenType === 'special' ? 'special' : source.tokenType === 'daily' ? 'daily' : null,
    streakBefore: toNonNegativeInteger(source.streakBefore),
    initialPickCount: clampPickCount(source.initialPickCount),
    requiredPickCount: clampPickCount(source.requiredPickCount),
    currentPhaseIndex,
    phases,
    initialBoard,
    selectedCardIndexes: [],
    resolvedCardIndexes: [],
    missedCardIndexes: normalizeCardPickIndexList(source.missedCardIndexes),
    rolls: [],
    bonusRolls: normalizeCardPickBonusRolls(source.bonusRolls),
    tier: null,
    rarity: null,
    rewardId: null
  };

  syncCardPickSession(session);
  return session;
}

export function isCardPickSessionActive(session) {
  return isRecord(session)
    && session.gameId === CARD_PICK_GAME.id
    && session.status !== CARD_PICK_SESSION_STATUS.COMPLETE;
}

export function getCurrentCardPickPhase(session) {
  if (!isRecord(session) || !Array.isArray(session.phases)) {
    return null;
  }

  return session.phases[toNonNegativeInteger(session.currentPhaseIndex)] || null;
}

export function getCardPickInitialBonusChance(streak) {
  const normalizedStreak = Math.max(0, Number(streak) || 0);
  return CARD_PICK_INITIAL_BONUS_CHANCE_BASE
    + ((1 - CARD_PICK_INITIAL_BONUS_CHANCE_BASE) * normalizedStreak / CARD_PICK_INITIAL_BONUS_CHANCE_STREAK_CAP);
}

export function selectCardPickCards(session, cardIndexes) {
  const phase = getCurrentCardPickPhase(session);
  if (!isCardPickSessionActive(session) || !phase) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  if (session.status !== CARD_PICK_SESSION_STATUS.SELECTING) {
    return cardPickActionFailure('Current selection is not editable', session);
  }

  const validation = validateCardPickSelection(session, phase, cardIndexes, { requireExactCount: false });
  if (!validation.success) {
    return cardPickActionFailure(validation.reason, session);
  }

  phase.selectedCardIndexes = validation.indexes;
  phase.revealedCardIndexes = [];
  phase.status = CARD_PICK_SESSION_STATUS.SELECTING;
  syncCardPickSession(session);

  return cardPickActionSuccess(session);
}

export function confirmCardPickSelection(session, cardIndexes = null) {
  if (cardIndexes !== null) {
    const selection = selectCardPickCards(session, cardIndexes);
    if (!selection.success) {
      return selection;
    }
  }

  const phase = getCurrentCardPickPhase(session);
  if (!isCardPickSessionActive(session) || !phase) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  if (session.status !== CARD_PICK_SESSION_STATUS.SELECTING) {
    return cardPickActionFailure('Current selection cannot be confirmed', session);
  }

  const validation = validateCardPickSelection(session, phase, phase.selectedCardIndexes, {
    requireExactCount: true
  });
  if (!validation.success) {
    return cardPickActionFailure(validation.reason, session);
  }

  phase.selectedCardIndexes = validation.indexes;
  phase.status = CARD_PICK_SESSION_STATUS.SELECTION_CONFIRMED;
  session.status = CARD_PICK_SESSION_STATUS.SELECTION_CONFIRMED;
  syncCardPickSession(session);

  return cardPickActionSuccess(session);
}

export function pickCardPickCard(session, cardIndex) {
  const phase = getCurrentCardPickPhase(session);
  if (!isCardPickSessionActive(session) || !phase) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  if (session.status !== CARD_PICK_SESSION_STATUS.SELECTING) {
    return cardPickActionFailure('Current selection is not editable', session);
  }

  const validation = validateCardPickSelection(
    session,
    phase,
    [...phase.selectedCardIndexes, cardIndex],
    {
      allowResolvedIndexes: phase.selectedCardIndexes,
      requireExactCount: false
    }
  );
  if (!validation.success) {
    return cardPickActionFailure(validation.reason, session);
  }

  phase.selectedCardIndexes = validation.indexes;
  if (phase.revealOnPick !== false) {
    phase.revealedCardIndexes = validation.indexes;
  } else {
    phase.revealedCardIndexes = [];
  }
  if (phase.selectedCardIndexes.length >= phase.pickCount) {
    phase.revealedSelected = true;
    phase.status = CARD_PICK_SESSION_STATUS.SELECTED_REVEALED;
    session.status = CARD_PICK_SESSION_STATUS.SELECTED_REVEALED;
  }

  syncCardPickSession(session);

  return cardPickActionSuccess(session);
}

export function advanceCardPickRevealedPhase(session, options = {}) {
  if (!isCardPickSessionActive(session)) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  syncCardPickSession(session);

  if (session.status !== CARD_PICK_SESSION_STATUS.SELECTED_REVEALED) {
    return cardPickActionFailure('Selected cards must reveal first', session);
  }

  const phase = getCurrentCardPickPhase(session);
  if (!phase) {
    return cardPickActionFailure('No active Card Pick phase', session);
  }

  const bonus = rollNextCardPickBonusPhase(session, options.randomFn);
  if (!bonus.success) {
    return bonus;
  }

  if (!bonus.startsBonus) {
    const missed = revealCardPickMissedCards(session);
    if (!missed.success) {
      return missed;
    }

    return cardPickActionSuccess(session, {
      startsBonus: false,
      bonusRoll: bonus.bonusRoll || null
    });
  }

  if (phase.type === 'initial') {
    const missed = revealCardPickMissedCards(session);
    if (!missed.success) {
      return missed;
    }
  }

  const started = startCardPickBonusPhase(session, {
    type: bonus.phaseType,
    pickCount: bonus.pickCount,
    multiplier: bonus.multiplier,
    revealOnPick: bonus.revealOnPick,
    shuffle: bonus.shuffle,
    randomFn: options.randomFn
  });
  if (!started.success) {
    return started;
  }

  return cardPickActionSuccess(session, {
    startsBonus: true,
    bonusRoll: bonus.bonusRoll || null
  });
}

export function revealCardPickSelectedCards(session) {
  const phase = getCurrentCardPickPhase(session);
  if (!isCardPickSessionActive(session) || !phase) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  if (session.status !== CARD_PICK_SESSION_STATUS.SELECTION_CONFIRMED) {
    return cardPickActionFailure('Card Pick selection is not confirmed', session);
  }

  const validation = validateCardPickSelection(session, phase, phase.selectedCardIndexes, {
    requireExactCount: true
  });
  if (!validation.success) {
    return cardPickActionFailure(validation.reason, session);
  }

  phase.selectedCardIndexes = validation.indexes;
  phase.revealedSelected = true;
  phase.status = CARD_PICK_SESSION_STATUS.SELECTED_REVEALED;
  session.status = CARD_PICK_SESSION_STATUS.SELECTED_REVEALED;
  syncCardPickSession(session);

  return cardPickActionSuccess(session, { rolls: phase.outcomes || [] });
}

export function revealCardPickMissedCards(session) {
  const phase = getCurrentCardPickPhase(session);
  if (!isCardPickSessionActive(session) || !phase) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  if (session.status !== CARD_PICK_SESSION_STATUS.SELECTED_REVEALED) {
    return cardPickActionFailure('Selected cards must reveal first', session);
  }

  const resolvedIndexes = new Set(session.resolvedCardIndexes || []);
  session.missedCardIndexes = Array.from(
    { length: CARD_PICK_CARD_COUNT },
    (_, index) => index
  ).filter((index) => !resolvedIndexes.has(index));
  phase.revealedMissed = true;
  phase.status = CARD_PICK_SESSION_STATUS.MISSED_REVEALED;
  session.status = CARD_PICK_SESSION_STATUS.MISSED_REVEALED;
  syncCardPickSession(session);

  return cardPickActionSuccess(session);
}

export function startCardPickBonusPhase(session, options = {}) {
  if (!isCardPickSessionActive(session)) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  syncCardPickSession(session);

  if (
    session.status !== CARD_PICK_SESSION_STATUS.SELECTED_REVEALED
    && session.status !== CARD_PICK_SESSION_STATUS.MISSED_REVEALED
  ) {
    return cardPickActionFailure('Bonus phase cannot start yet', session);
  }

  const resolvedIndexes = new Set(session.resolvedCardIndexes || []);
  const remainingCount = CARD_PICK_CARD_COUNT - resolvedIndexes.size;
  if (remainingCount <= 0) {
    return cardPickActionFailure('No cards remain for a bonus phase', session);
  }

  const previousPhase = getCurrentCardPickPhase(session);
  const pickCount = Math.min(remainingCount, Math.max(1, toNonNegativeInteger(options.pickCount, 1)));
  const previousMultiplier = Math.max(1, Number(previousPhase?.multiplier) || 1);
  const multiplier = Math.max(1, Number(options.multiplier) || previousMultiplier * 2);
  const shouldShuffle = options.shuffle !== false;

  if (shouldShuffle) {
    multiplyAndShuffleRemainingCards(session, multiplier, options.randomFn);
  } else {
    multiplyRemainingCards(session, multiplier);
  }

  const phase = createCardPickPhase({
    type: typeof options.type === 'string' && options.type ? options.type : getNextBonusPhaseType(session),
    pickCount,
    multiplier,
    revealOnPick: options.revealOnPick !== false,
    shuffledBeforeStart: shouldShuffle
  });

  session.missedCardIndexes = [];
  session.phases.push(phase);
  session.currentPhaseIndex = session.phases.length - 1;
  session.status = CARD_PICK_SESSION_STATUS.SELECTING;
  syncCardPickSession(session);

  return cardPickActionSuccess(session);
}

export function completeCardPickSession(session, now = Date.now()) {
  if (!isCardPickSessionActive(session)) {
    return cardPickActionFailure('No active Card Pick session', session);
  }

  if (
    session.status === CARD_PICK_SESSION_STATUS.SELECTING
    || session.status === CARD_PICK_SESSION_STATUS.SELECTION_CONFIRMED
  ) {
    return cardPickActionFailure('Card Pick session still has unresolved selections', session);
  }

  syncCardPickSession(session);
  if (!session.rolls.length) {
    return cardPickActionFailure('Card Pick session has no collected rewards', session);
  }

  session.status = CARD_PICK_SESSION_STATUS.COMPLETE;
  session.completedAt = toTimestamp(now);
  syncCardPickSession(session);

  return cardPickActionSuccess(session, { summary: getCardPickRewardSummary(session) });
}

export function getCardPickRewardSummary(session) {
  const rolls = Array.isArray(session?.rolls) ? session.rolls : [];
  const rewardCounts = {};
  let rewardTotal = 0;
  let best = null;

  for (const roll of rolls) {
    if (!CARD_PICK_REWARD_IDS.has(roll?.rewardId)) {
      continue;
    }

    const quantity = Math.max(1, Math.floor(Number(roll.multiplier) || 1));
    rewardCounts[roll.rewardId] = Math.max(0, Number(rewardCounts[roll.rewardId]) || 0) + quantity;
    rewardTotal += quantity;

    if (!best || roll.tier > best.tier) {
      best = roll;
    }
  }

  return {
    rolls,
    rewardCounts,
    rewardTotal,
    tier: best?.tier ?? null,
    rarity: best?.rarity ?? null,
    rewardId: best?.rewardId ?? null,
    selectedCardIndexes: Array.isArray(session?.selectedCardIndexes)
      ? [...session.selectedCardIndexes]
      : [],
    bonusRolls: Array.isArray(session?.bonusRolls)
      ? session.bonusRolls.map(cloneCardPickBonusRoll)
      : [],
    phases: Array.isArray(session?.phases)
      ? session.phases.map(cloneCardPickPhase)
      : []
  };
}

export function rollCardTier(randomFn) {
  const random = Math.min(Math.max(Number(randomFn()) || 0, 0), 0.999999999);
  let cursor = 0;
  for (const tier of CARD_PICK_TIERS) {
    cursor += tier.chance;
    if (random < cursor) return tier;
  }
  return FALLBACK_TIER;
}

function createCardPickBoard(randomFn) {
  return Array.from({ length: CARD_PICK_CARD_COUNT }, (_, cardIndex) => ({
    ...rollCardTier(randomFn),
    cardIndex,
    multiplier: 1,
    selected: false,
    resolved: false,
    revealed: false,
    missed: false
  }));
}

function createCardPickPhase(config) {
  return {
    type: config.type,
    pickCount: clampPickCount(config.pickCount),
    multiplier: Math.max(1, Number(config.multiplier) || 1),
    revealOnPick: config.revealOnPick !== false,
    shuffledBeforeStart: Boolean(config.shuffledBeforeStart),
    selectedCardIndexes: [],
    revealedCardIndexes: [],
    revealedSelected: false,
    revealedMissed: false,
    status: CARD_PICK_SESSION_STATUS.SELECTING,
    outcomes: []
  };
}

function normalizeCardPickPhase(source) {
  if (!isRecord(source) || typeof source.type !== 'string' || !source.type) {
    return null;
  }

  const status = CARD_PICK_SESSION_STATUSES.has(source.status)
    ? source.status
    : CARD_PICK_SESSION_STATUS.SELECTING;

  return {
    type: source.type,
    pickCount: clampPickCount(source.pickCount),
    multiplier: Math.max(1, Number(source.multiplier) || 1),
    revealOnPick: source.revealOnPick !== false,
    shuffledBeforeStart: Boolean(source.shuffledBeforeStart),
    selectedCardIndexes: normalizeCardPickIndexList(source.selectedCardIndexes),
    revealedCardIndexes: normalizeCardPickIndexList(source.revealedCardIndexes),
    revealedSelected: Boolean(source.revealedSelected),
    revealedMissed: Boolean(source.revealedMissed),
    status,
    outcomes: []
  };
}

function normalizeCardPickBoardCard(source, cardIndex) {
  const rewardId = typeof source?.rewardId === 'string' ? source.rewardId : FALLBACK_TIER.rewardId;
  const tier = CARD_PICK_TIERS.find((candidate) => candidate.rewardId === rewardId)
    || CARD_PICK_TIERS.find((candidate) => candidate.tier === toNonNegativeInteger(source?.tier, 1))
    || FALLBACK_TIER;

  return {
    ...tier,
    cardIndex,
    multiplier: Math.max(1, Number(source?.multiplier) || 1),
    selected: Boolean(source?.selected),
    resolved: Boolean(source?.resolved),
    revealed: Boolean(source?.revealed),
    missed: Boolean(source?.missed)
  };
}

function validateCardPickSelection(session, phase, cardIndexes, options = {}) {
  if (!Array.isArray(cardIndexes)) {
    return { success: false, reason: 'Choose cards first' };
  }

  const seen = new Set();
  const indexes = [];
  for (const value of cardIndexes) {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= CARD_PICK_CARD_COUNT) {
      return { success: false, reason: 'Card selection contains invalid cards' };
    }

    if (seen.has(index)) {
      return { success: false, reason: 'Card selection contains duplicate cards' };
    }

    seen.add(index);
    indexes.push(index);
  }

  if (indexes.length !== cardIndexes.length) {
    return { success: false, reason: 'Card selection contains invalid cards' };
  }

  if (indexes.length > phase.pickCount) {
    return { success: false, reason: `Choose ${phase.pickCount} card${phase.pickCount === 1 ? '' : 's'} or fewer` };
  }

  if (options.requireExactCount && indexes.length !== phase.pickCount) {
    return { success: false, reason: `Choose ${phase.pickCount} card${phase.pickCount === 1 ? '' : 's'}` };
  }

  const resolvedIndexes = new Set(session.resolvedCardIndexes || []);
  const allowedResolvedIndexes = new Set(normalizeCardPickIndexList(options.allowResolvedIndexes));
  for (const index of indexes) {
    if (resolvedIndexes.has(index) && !allowedResolvedIndexes.has(index)) {
      return { success: false, reason: 'Card is already resolved' };
    }
  }

  return { success: true, indexes };
}

function normalizeCardPickIndexList(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  const seen = new Set();
  const indexes = [];
  for (const value of source) {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= CARD_PICK_CARD_COUNT || seen.has(index)) {
      continue;
    }
    seen.add(index);
    indexes.push(index);
  }

  return indexes;
}

function normalizeCardPickBonusRolls(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .filter(isRecord)
    .map((roll) => ({
      phaseIndex: toNonNegativeInteger(roll.phaseIndex),
      phaseType: typeof roll.phaseType === 'string' ? roll.phaseType : '',
      chanceType: typeof roll.chanceType === 'string' ? roll.chanceType : '',
      chance: Math.max(0, Number(roll.chance) || 0),
      roll: Math.max(0, Number(roll.roll) || 0),
      success: Boolean(roll.success),
      pickCount: toNonNegativeInteger(roll.pickCount),
      multiplier: Math.max(1, Number(roll.multiplier) || 1),
      startsBonus: Boolean(roll.startsBonus)
    }));
}

function syncCardPickSession(session) {
  const selectedIndexes = [];
  const resolvedIndexes = [];
  const rolls = [];
  const missedIndexes = new Set(normalizeCardPickIndexList(session.missedCardIndexes));

  for (const phase of session.phases || []) {
    phase.selectedCardIndexes = normalizeCardPickIndexList(phase.selectedCardIndexes);
    phase.revealedCardIndexes = normalizeCardPickIndexList(phase.revealedCardIndexes)
      .filter((index) => phase.selectedCardIndexes.includes(index));
    phase.outcomes = [];

    for (const index of phase.selectedCardIndexes) {
      selectedIndexes.push(index);
    }

    const revealedIndexes = phase.revealedSelected
      ? phase.selectedCardIndexes
      : phase.revealedCardIndexes;

    for (const index of revealedIndexes) {
      const card = session.initialBoard[index] || normalizeCardPickBoardCard(null, index);
      const outcome = createCardPickOutcome(card, index, phase);
      phase.outcomes.push(outcome);
      resolvedIndexes.push(index);
      rolls.push(outcome);
    }
  }

  const selectedSet = new Set(selectedIndexes);
  const resolvedSet = new Set(resolvedIndexes);
  for (let index = 0; index < CARD_PICK_CARD_COUNT; index += 1) {
    const card = session.initialBoard[index];
    if (!card) continue;
    const isResolved = resolvedSet.has(index);
    const isMissed = missedIndexes.has(index);

    card.selected = selectedSet.has(index);
    card.resolved = isResolved;
    card.missed = isMissed && !isResolved;
    card.revealed = isResolved || isMissed || session.status === CARD_PICK_SESSION_STATUS.COMPLETE;
  }

  const currentPhase = getCurrentCardPickPhase(session);
  const best = rolls.reduce(
    (currentBest, roll) => (!currentBest || roll.tier > currentBest.tier ? roll : currentBest),
    null
  );

  session.selectedCardIndexes = selectedIndexes;
  session.resolvedCardIndexes = resolvedIndexes;
  session.missedCardIndexes = Array.from(missedIndexes).filter((index) => !resolvedSet.has(index));
  session.rolls = rolls;
  session.requiredPickCount = session.status === CARD_PICK_SESSION_STATUS.COMPLETE
    ? 0
    : Math.max(0, Number(currentPhase?.pickCount) || 0);
  session.tier = best?.tier ?? null;
  session.rarity = best?.rarity ?? null;
  session.rewardId = best?.rewardId ?? null;

  return session;
}

function createCardPickOutcome(card, cardIndex, phase) {
  return {
    tier: card.tier,
    rarity: card.rarity,
    rewardId: card.rewardId,
    color: card.color,
    multiplier: Math.max(1, Number(card.multiplier) || Number(phase.multiplier) || 1),
    cardIndex,
    phaseType: phase.type
  };
}

function multiplyAndShuffleRemainingCards(session, multiplier, randomFn = Math.random) {
  if (!Array.isArray(session?.initialBoard)) {
    return;
  }

  const resolvedIndexes = new Set(session.resolvedCardIndexes || []);
  const remainingIndexes = [];
  const remainingCards = [];

  for (let index = 0; index < CARD_PICK_CARD_COUNT; index += 1) {
    if (resolvedIndexes.has(index)) {
      continue;
    }

    const card = session.initialBoard[index] || normalizeCardPickBoardCard(null, index);
    remainingIndexes.push(index);
    remainingCards.push({
      ...card,
      multiplier,
      selected: false,
      resolved: false,
      revealed: false,
      missed: false
    });
  }

  shuffleCards(remainingCards, randomFn);

  for (let offset = 0; offset < remainingIndexes.length; offset += 1) {
    const cardIndex = remainingIndexes[offset];
    session.initialBoard[cardIndex] = {
      ...remainingCards[offset],
      cardIndex
    };
  }
}

function multiplyRemainingCards(session, multiplier) {
  if (!Array.isArray(session?.initialBoard)) {
    return;
  }

  const resolvedIndexes = new Set(session.resolvedCardIndexes || []);
  for (let index = 0; index < CARD_PICK_CARD_COUNT; index += 1) {
    if (resolvedIndexes.has(index)) {
      continue;
    }

    const card = session.initialBoard[index] || normalizeCardPickBoardCard(null, index);
    session.initialBoard[index] = {
      ...card,
      cardIndex: index,
      multiplier,
      selected: false,
      resolved: false,
      revealed: false,
      missed: false
    };
  }
}

function shuffleCards(cards, randomFn) {
  const getRandom = typeof randomFn === 'function' ? randomFn : Math.random;
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const random = Math.min(Math.max(Number(getRandom()) || 0, 0), 0.999999999);
    const swapIndex = Math.floor(random * (i + 1));
    [cards[i], cards[swapIndex]] = [cards[swapIndex], cards[i]];
  }
}

function cloneCardPickPhase(phase) {
  return {
    type: phase.type,
    pickCount: phase.pickCount,
    multiplier: phase.multiplier,
    revealOnPick: phase.revealOnPick !== false,
    shuffledBeforeStart: Boolean(phase.shuffledBeforeStart),
    selectedCardIndexes: [...phase.selectedCardIndexes],
    revealedCardIndexes: Array.isArray(phase.revealedCardIndexes) ? [...phase.revealedCardIndexes] : [],
    revealedSelected: Boolean(phase.revealedSelected),
    revealedMissed: Boolean(phase.revealedMissed),
    status: phase.status,
    outcomes: Array.isArray(phase.outcomes) ? phase.outcomes.map((outcome) => ({ ...outcome })) : []
  };
}

function cloneCardPickBonusRoll(roll) {
  return {
    phaseIndex: roll.phaseIndex,
    phaseType: roll.phaseType,
    chanceType: roll.chanceType,
    chance: roll.chance,
    roll: roll.roll,
    success: Boolean(roll.success),
    pickCount: roll.pickCount,
    multiplier: roll.multiplier,
    startsBonus: Boolean(roll.startsBonus)
  };
}

function getNextBonusPhaseType(session) {
  const bonusPhaseCount = Array.isArray(session.phases)
    ? session.phases.filter((phase) => phase.type.startsWith('bonus')).length
    : 0;

  if (bonusPhaseCount === 0) return 'bonus_1';
  if (bonusPhaseCount === 1) return 'bonus_2';
  return 'bonus_consecutive';
}

function rollNextCardPickBonusPhase(session, randomFn = Math.random) {
  const phase = getCurrentCardPickPhase(session);
  if (!phase) {
    return cardPickActionFailure('No active Card Pick phase', session);
  }

  const remainingCount = getRemainingCardPickCount(session);
  if (remainingCount <= 0) {
    return {
      success: true,
      startsBonus: false,
      bonusRoll: null
    };
  }

  const getRandom = typeof randomFn === 'function' ? randomFn : Math.random;
  const previousMultiplier = Math.max(1, Number(phase.multiplier) || 1);

  if (phase.type === 'initial') {
    return rollSingleCardPickBonus({
      session,
      phase,
      chanceType: 'initial',
      chance: getCardPickInitialBonusChance(session.streakBefore),
      roll: getChanceRoll(getRandom),
      phaseType: 'bonus_1',
      pickCount: 1,
      multiplier: previousMultiplier * 2,
      revealOnPick: true,
      shuffle: true
    });
  }

  if (phase.type === 'bonus_1') {
    return rollSingleCardPickBonus({
      session,
      phase,
      chanceType: 'second',
      chance: CARD_PICK_SECOND_BONUS_CHANCE,
      roll: getChanceRoll(getRandom),
      phaseType: 'bonus_2',
      pickCount: 1,
      multiplier: previousMultiplier * 2,
      revealOnPick: true,
      shuffle: true
    });
  }

  if (phase.type === 'bonus_2') {
    return rollConsecutiveCardPickBonus({
      session,
      phase,
      remainingCount,
      randomFn: getRandom,
      multiplier: previousMultiplier
    });
  }

  return {
    success: true,
    startsBonus: false,
    bonusRoll: null
  };
}

function rollSingleCardPickBonus(config) {
  const startsBonus = config.roll < config.chance;
  const pickCount = startsBonus ? Math.min(1, getRemainingCardPickCount(config.session)) : 0;
  const bonusRoll = recordCardPickBonusRoll(config.session, {
    phaseIndex: config.session.currentPhaseIndex,
    phaseType: config.phase.type,
    chanceType: config.chanceType,
    chance: config.chance,
    roll: config.roll,
    success: startsBonus,
    pickCount,
    multiplier: config.multiplier,
    startsBonus
  });

  if (!startsBonus) {
    return {
      success: true,
      startsBonus: false,
      bonusRoll
    };
  }

  return {
    success: true,
    startsBonus: true,
    phaseType: config.phaseType,
    pickCount,
    multiplier: config.multiplier,
    revealOnPick: config.revealOnPick,
    shuffle: config.shuffle,
    bonusRoll
  };
}

function rollConsecutiveCardPickBonus(config) {
  const firstRoll = getChanceRoll(config.randomFn);
  const startsBonus = firstRoll < CARD_PICK_CONSECUTIVE_BONUS_CHANCE;
  let pickCount = startsBonus ? 1 : 0;

  while (startsBonus && pickCount < config.remainingCount) {
    const roll = getChanceRoll(config.randomFn);
    if (roll >= CARD_PICK_CONSECUTIVE_BONUS_CHANCE) {
      break;
    }
    pickCount += 1;
  }

  const bonusRoll = recordCardPickBonusRoll(config.session, {
    phaseIndex: config.session.currentPhaseIndex,
    phaseType: config.phase.type,
    chanceType: 'consecutive',
    chance: CARD_PICK_CONSECUTIVE_BONUS_CHANCE,
    roll: firstRoll,
    success: startsBonus,
    pickCount,
    multiplier: config.multiplier,
    startsBonus
  });

  if (!startsBonus) {
    return {
      success: true,
      startsBonus: false,
      bonusRoll
    };
  }

  return {
    success: true,
    startsBonus: true,
    phaseType: 'bonus_consecutive',
    pickCount,
    multiplier: config.multiplier,
    revealOnPick: false,
    shuffle: false,
    bonusRoll
  };
}

function recordCardPickBonusRoll(session, roll) {
  if (!Array.isArray(session.bonusRolls)) {
    session.bonusRolls = [];
  }

  const normalized = {
    phaseIndex: toNonNegativeInteger(roll.phaseIndex),
    phaseType: roll.phaseType,
    chanceType: roll.chanceType,
    chance: Math.max(0, Number(roll.chance) || 0),
    roll: Math.max(0, Number(roll.roll) || 0),
    success: Boolean(roll.success),
    pickCount: toNonNegativeInteger(roll.pickCount),
    multiplier: Math.max(1, Number(roll.multiplier) || 1),
    startsBonus: Boolean(roll.startsBonus)
  };

  session.bonusRolls.push(normalized);
  return normalized;
}

function getRemainingCardPickCount(session) {
  const resolvedIndexes = new Set(session.resolvedCardIndexes || []);
  return Math.max(0, CARD_PICK_CARD_COUNT - resolvedIndexes.size);
}

function getChanceRoll(randomFn) {
  return Math.min(Math.max(Number(randomFn()) || 0, 0), 0.999999999);
}

function cardPickActionSuccess(session, extra = {}) {
  return {
    success: true,
    session,
    ...extra
  };
}

function cardPickActionFailure(reason, session = null) {
  return {
    success: false,
    reason,
    session
  };
}

function clampPickCount(value) {
  return Math.min(CARD_PICK_CARD_COUNT, Math.max(1, toNonNegativeInteger(value, 1)));
}

function toNonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.floor(Number(value) || fallback));
}

function toTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Date.now();
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
