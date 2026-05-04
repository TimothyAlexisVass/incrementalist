import {
  advanceDailyBonusStreak,
  getDailyBonusRotation,
  getSpendableBonusTokenCount,
  refreshDailyBonusState,
  spendBonusToken
} from './state.js';
import {
  getDailyBonusAttemptCount,
  getDailyBonusGameForSlot,
  rollDailyBonusGame
} from './games/index.js';
import {
  CARD_PICK_GAME,
  advanceCardPickRevealedPhase,
  completeCardPickSession,
  confirmCardPickSelection,
  createCardPickSession,
  getCardPickRewardSummary,
  isCardPickSessionActive,
  pickCardPickCard,
  revealCardPickMissedCards,
  revealCardPickSelectedCards,
  selectCardPickCards,
  startCardPickBonusPhase
} from './games/card-pick/index.js';
import {
  getChecklistProgress,
  isChecklistGame
} from './games/checklist/index.js';

export function playDailyBonus(gameState, now = Date.now(), options = {}) {
  const context = getDailyBonusPlayContext(gameState, now);
  if (!context.success) {
    return context;
  }

  if (context.game.id === CARD_PICK_GAME.id) {
    return startCardPickDailyBonusFromContext(context, now, options.randomFn);
  }

  return resolveOneShotDailyBonusPlay(context, now, options.randomFn);
}

export function startCardPickDailyBonus(gameState, now = Date.now(), options = {}) {
  const context = getDailyBonusPlayContext(gameState, now);
  if (!context.success) {
    return context;
  }

  if (context.game.id !== CARD_PICK_GAME.id) {
    return { success: false, reason: 'Card Pick is not active' };
  }

  return startCardPickDailyBonusFromContext(context, now, options.randomFn);
}

export function selectCardPickDailyBonusCards(gameState, cardIndexes) {
  return runCardPickSessionAction(gameState, 'card_pick_select', (session) => (
    selectCardPickCards(session, cardIndexes)
  ));
}

export function confirmCardPickDailyBonusSelection(gameState, cardIndexes = null) {
  return runCardPickSessionAction(gameState, 'card_pick_confirm', (session) => (
    confirmCardPickSelection(session, cardIndexes)
  ));
}

export function pickCardPickDailyBonusCard(gameState, cardIndex) {
  return runCardPickSessionAction(gameState, 'card_pick_pick_card', (session) => (
    pickCardPickCard(session, cardIndex)
  ));
}

export function revealCardPickDailyBonusSelectedCards(gameState) {
  return runCardPickSessionAction(gameState, 'card_pick_reveal_selected', (session) => (
    revealCardPickSelectedCards(session)
  ));
}

export function revealCardPickDailyBonusMissedCards(gameState) {
  return runCardPickSessionAction(gameState, 'card_pick_reveal_missed', (session) => (
    revealCardPickMissedCards(session)
  ));
}

export function startCardPickDailyBonusPhase(gameState, options = {}) {
  return runCardPickSessionAction(gameState, 'card_pick_start_bonus', (session) => (
    startCardPickBonusPhase(session, options)
  ));
}

export function advanceCardPickDailyBonusPhase(gameState, options = {}) {
  return runCardPickSessionAction(gameState, 'card_pick_advance_phase', (session) => (
    advanceCardPickRevealedPhase(session, options)
  ));
}

export function completeCardPickDailyBonusSession(gameState, now = Date.now()) {
  const dailyBonus = gameState?.dailyBonus;
  if (!dailyBonus) {
    return { success: false, reason: 'Bonus time is not ready' };
  }

  const session = dailyBonus.cardPickSession;
  if (!isCardPickSessionActive(session)) {
    return { success: false, reason: 'No active Card Pick session' };
  }

  const completion = completeCardPickSession(session, now);
  if (!completion.success) {
    return completion;
  }

  const summary = completion.summary || getCardPickRewardSummary(session);
  if (summary.rewardTotal <= 0) {
    return { success: false, reason: 'Card Pick session has no collected rewards', session };
  }

  const streakUpdate = advanceDailyBonusStreak(dailyBonus, now);
  dailyBonus.totalGamesPlayed = Math.max(0, Number(dailyBonus.totalGamesPlayed) || 0) + 1;
  dailyBonus.rewardsReceived = Math.max(0, Number(dailyBonus.rewardsReceived) || 0) + summary.rewardTotal;

  ensureRewardCounts(dailyBonus);
  for (const [rewardId, quantity] of Object.entries(summary.rewardCounts)) {
    dailyBonus.rewardCounts[rewardId] = Math.max(
      0,
      Number(dailyBonus.rewardCounts?.[rewardId]) || 0
    ) + quantity;
  }

  const result = {
    success: true,
    action: 'card_pick_complete',
    gameId: CARD_PICK_GAME.id,
    gameName: CARD_PICK_GAME.name,
    slot: CARD_PICK_GAME.slot,
    tokenType: session.tokenType,
    rolls: summary.rolls,
    spins: [],
    phases: summary.phases,
    bonusRolls: summary.bonusRolls,
    initialBoard: session.initialBoard,
    selectedCardIndexes: summary.selectedCardIndexes,
    tier: summary.tier,
    rarity: summary.rarity,
    rewardId: summary.rewardId,
    rewardCounts: summary.rewardCounts,
    rewardTotal: summary.rewardTotal,
    playedAt: now,
    streakBefore: session.streakBefore,
    streakAfter: streakUpdate.streakAfter,
    streakBroken: streakUpdate.streakBroken,
    streakImproved: streakUpdate.streakImproved,
    checklistEntry: null,
    entryNumber: null,
    completedCountBefore: null,
    completedCountAfter: null,
    nextEntryIndex: null,
    cycleCompleted: false,
    dailyTokens: dailyBonus.dailyTokens || 0,
    specialTokens: dailyBonus.specialTokens || 0
  };

  dailyBonus.lastResult = {
    gameId: result.gameId,
    slot: result.slot,
    rewardId: result.rewardId,
    rarity: result.rarity,
    tier: result.tier,
    playedAt: result.playedAt,
    tokenType: result.tokenType,
    streakBefore: result.streakBefore,
    streakAfter: result.streakAfter,
    selectedCardIndexes: result.selectedCardIndexes,
    rewardCounts: result.rewardCounts,
    rewardTotal: result.rewardTotal,
    phases: result.phases,
    bonusRolls: result.bonusRolls,
    entryNumber: null,
    completedCountAfter: null,
    cycleCompleted: false
  };
  dailyBonus.cardPickSession = null;

  return result;
}

function getDailyBonusPlayContext(gameState, now) {
  const dailyBonus = gameState?.dailyBonus;
  if (!dailyBonus) {
    return { success: false, reason: 'Bonus time is not ready' };
  }

  refreshDailyBonusState(dailyBonus, now);

  if (getSpendableBonusTokenCount(dailyBonus) <= 0) {
    return { success: false, reason: 'No bonus token' };
  }

  const rotation = getDailyBonusRotation(dailyBonus, now);
  const game = getDailyBonusGameForSlot(rotation.activeSlot);
  return {
    success: true,
    dailyBonus,
    rotation,
    game
  };
}

function resolveOneShotDailyBonusPlay(context, now, randomFn = Math.random) {
  const {
    dailyBonus,
    rotation,
    game
  } = context;
  const tokenType = spendBonusToken(dailyBonus);
  if (!tokenType) {
    return { success: false, reason: 'No bonus token' };
  }

  const streakBefore = dailyBonus.streak || 0;
  const gameResult = rollDailyBonusGame(game, {
    dailyBonusState: dailyBonus,
    streak: streakBefore,
    randomFn
  });

  if (gameResult.status === 'requires_interaction') {
    // For games like Coin Rain that need real-time play, we pass back the required interaction state
    // and wait for the render layer to report the completion to save the state.
    // The main app flow handles this asynchronously.
    return { success: true, pendingInteraction: true, gameId: game.id, parameters: gameResult.parameters };
  }

  const streakUpdate = advanceDailyBonusStreak(dailyBonus, now);
  const result = {
    success: true,
    gameId: game.id,
    gameName: game.name,
    slot: rotation.activeSlot,
    tokenType,
    rolls: gameResult.rolls || [],
    spins: gameResult.spins || [],
    phases: gameResult.phases || [],
    initialBoard: gameResult.initialBoard || null,
    selectedCardIndexes: gameResult.selectedCardIndexes || [],
    tier: gameResult.tier,
    rarity: gameResult.rarity,
    rewardId: gameResult.rewardId,
    playedAt: now,
    streakBefore,
    streakAfter: streakUpdate.streakAfter,
    streakBroken: streakUpdate.streakBroken,
    streakImproved: streakUpdate.streakImproved,
    checklistEntry: gameResult.checklistEntry || null,
    entryNumber: gameResult.entryNumber || null,
    completedCountBefore: gameResult.completedCountBefore ?? null,
    completedCountAfter: gameResult.completedCountAfter ?? null,
    nextEntryIndex: gameResult.nextEntryIndex ?? null,
    cycleCompleted: Boolean(gameResult.cycleCompleted),
    dailyTokens: dailyBonus.dailyTokens || 0,
    specialTokens: dailyBonus.specialTokens || 0
  };

  dailyBonus.totalGamesPlayed = Math.max(0, Number(dailyBonus.totalGamesPlayed) || 0) + 1;
  dailyBonus.rewardsReceived = Math.max(0, Number(dailyBonus.rewardsReceived) || 0) + 1;
  ensureRewardCounts(dailyBonus);
  dailyBonus.rewardCounts[result.rewardId] = Math.max(
    0,
    Number(dailyBonus.rewardCounts?.[result.rewardId]) || 0
  ) + 1;
  dailyBonus.lastResult = {
    gameId: result.gameId,
    slot: result.slot,
    rewardId: result.rewardId,
    rarity: result.rarity,
    tier: result.tier,
    playedAt: result.playedAt,
    tokenType: result.tokenType,
    streakBefore: result.streakBefore,
    streakAfter: result.streakAfter,
    entryNumber: result.entryNumber,
    completedCountAfter: result.completedCountAfter,
    cycleCompleted: result.cycleCompleted
  };

  return result;
}

function startCardPickDailyBonusFromContext(context, now, randomFn = Math.random) {
  const {
    dailyBonus,
    rotation
  } = context;

  if (isCardPickSessionActive(dailyBonus.cardPickSession)) {
    return { success: false, reason: 'Card Pick already in progress' };
  }

  const tokenType = spendBonusToken(dailyBonus);
  if (!tokenType) {
    return { success: false, reason: 'No bonus token' };
  }

  const streakBefore = Math.max(0, Number(dailyBonus.streak) || 0);
  const session = createCardPickSession({
    randomFn,
    streakBefore,
    tokenType,
    now
  });
  dailyBonus.cardPickSession = session;

  return {
    success: true,
    action: 'card_pick_start',
    gameId: CARD_PICK_GAME.id,
    gameName: CARD_PICK_GAME.name,
    slot: rotation.activeSlot,
    tokenType,
    session,
    status: session.status,
    rolls: [],
    spins: [],
    phases: session.phases,
    bonusRolls: session.bonusRolls,
    initialBoard: session.initialBoard,
    selectedCardIndexes: session.selectedCardIndexes,
    currentPhaseIndex: session.currentPhaseIndex,
    tier: null,
    rarity: null,
    rewardId: null,
    playedAt: now,
    streakBefore,
    streakAfter: streakBefore,
    streakBroken: false,
    streakImproved: false,
    checklistEntry: null,
    entryNumber: null,
    completedCountBefore: null,
    completedCountAfter: null,
    nextEntryIndex: null,
    cycleCompleted: false,
    dailyTokens: dailyBonus.dailyTokens || 0,
    specialTokens: dailyBonus.specialTokens || 0
  };
}

function runCardPickSessionAction(gameState, action, callback) {
  const dailyBonus = gameState?.dailyBonus;
  if (!dailyBonus) {
    return { success: false, reason: 'Bonus time is not ready' };
  }

  const session = dailyBonus.cardPickSession;
  if (!isCardPickSessionActive(session)) {
    return { success: false, reason: 'No active Card Pick session' };
  }

  const result = callback(session);
  if (!result.success) {
    return result;
  }

  return {
    success: true,
    action,
    gameId: CARD_PICK_GAME.id,
    gameName: CARD_PICK_GAME.name,
    slot: CARD_PICK_GAME.slot,
    session,
    status: session.status,
    tokenType: session.tokenType,
    rolls: session.rolls,
    spins: [],
    phases: session.phases,
    bonusRolls: session.bonusRolls,
    initialBoard: session.initialBoard,
    selectedCardIndexes: session.selectedCardIndexes,
    currentPhaseIndex: session.currentPhaseIndex,
    startsBonus: Boolean(result.startsBonus),
    bonusRoll: result.bonusRoll || null,
    tier: session.tier,
    rarity: session.rarity,
    rewardId: session.rewardId,
    streakBefore: session.streakBefore,
    dailyTokens: dailyBonus.dailyTokens || 0,
    specialTokens: dailyBonus.specialTokens || 0
  };
}

function ensureRewardCounts(dailyBonus) {
  if (!dailyBonus.rewardCounts || typeof dailyBonus.rewardCounts !== 'object') {
    dailyBonus.rewardCounts = {};
  }
}

export function canPlayDailyBonus(gameState) {
  const dailyBonus = gameState?.dailyBonus;
  if (isCardPickSessionActive(dailyBonus?.cardPickSession)) {
    return false;
  }

  return getSpendableBonusTokenCount(dailyBonus) > 0;
}

export function getDailyBonusUIState(dailyBonusState, now = Date.now()) {
  const rotation = getDailyBonusRotation(dailyBonusState, now);
  const game = getDailyBonusGameForSlot(rotation.activeSlot);
  const streak = Math.max(0, Number(dailyBonusState?.streak) || 0);
  const dailyTokens = Math.max(0, Math.floor(Number(dailyBonusState?.dailyTokens) || 0));
  const specialTokens = Math.max(0, Math.floor(Number(dailyBonusState?.specialTokens) || 0));
  const attemptCount = getDailyBonusAttemptCount(game.id, streak);
  const checklist = isChecklistGame(game)
    ? getChecklistProgress(dailyBonusState, game)
    : null;
  const cardPickSession = game.id === CARD_PICK_GAME.id && isCardPickSessionActive(dailyBonusState?.cardPickSession)
    ? dailyBonusState.cardPickSession
    : null;

  return {
    gameId: game.id,
    gameName: game.name,
    rotation,
    dailyTokens,
    specialTokens,
    tokenCount: dailyTokens + specialTokens,
    canPlay: dailyTokens + specialTokens > 0 && !cardPickSession,
    streak,
    attemptCount,
    chestRolls: game.id === 'chest_draw' ? attemptCount : 0,
    wheelSpins: game.id === 'prize_wheel' ? attemptCount : 0,
    checklist,
    cardPickSession,
    totalGamesPlayed: Math.max(0, Number(dailyBonusState?.totalGamesPlayed) || 0),
    rewardsReceived: Math.max(0, Number(dailyBonusState?.rewardsReceived) || 0),
    rewardCounts: dailyBonusState?.rewardCounts || {},
    lastResult: dailyBonusState?.lastResult || null
  };
}
