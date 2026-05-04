import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_BONUS_SLOT_MS,
  createDailyBonusState,
  getUtcBoundaryStart
} from './state.js';
import {
  advanceCardPickDailyBonusPhase,
  completeCardPickDailyBonusSession,
  confirmCardPickDailyBonusSelection,
  playDailyBonus,
  revealCardPickDailyBonusMissedCards,
  revealCardPickDailyBonusSelectedCards,
  selectCardPickDailyBonusCards
} from './evaluate.js';
import {
  CARD_PICK_CARD_COUNT,
  CARD_PICK_GAME,
  CARD_PICK_SESSION_STATUS
} from './games/card-pick/index.js';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);

test('Card Pick play starts a session without awarding rewards or streak', () => {
  const gameState = createCardPickGameState({ streak: 14 });

  const result = playDailyBonus(gameState, NOW, { randomFn: () => 0 });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.action, 'card_pick_start');
  assert.strictEqual(result.gameId, CARD_PICK_GAME.id);
  assert.strictEqual(result.initialBoard.length, CARD_PICK_CARD_COUNT);
  assert.strictEqual(result.selectedCardIndexes.length, 0);
  assert.strictEqual(result.rolls.length, 0);
  assert.strictEqual(result.session.initialPickCount, 4);
  assert.strictEqual(result.session.status, CARD_PICK_SESSION_STATUS.SELECTING);

  assert.strictEqual(gameState.dailyBonus.dailyTokens, 0);
  assert.strictEqual(gameState.dailyBonus.totalGamesPlayed, 0);
  assert.strictEqual(gameState.dailyBonus.rewardsReceived, 0);
  assert.strictEqual(gameState.dailyBonus.streak, 14);
  assert.strictEqual(gameState.dailyBonus.lastResult, null);
});

test('Card Pick completion applies rewards, stats, and streak after reveal', () => {
  const gameState = createCardPickGameState({ streak: 14 });
  playDailyBonus(gameState, NOW, { randomFn: () => 0 });

  assert.strictEqual(selectCardPickDailyBonusCards(gameState, [0, 1, 2, 3]).success, true);
  assert.strictEqual(confirmCardPickDailyBonusSelection(gameState).success, true);
  assert.strictEqual(revealCardPickDailyBonusSelectedCards(gameState).success, true);
  assert.strictEqual(revealCardPickDailyBonusMissedCards(gameState).success, true);

  const result = completeCardPickDailyBonusSession(gameState, NOW + 1_000);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.action, 'card_pick_complete');
  assert.strictEqual(result.rolls.length, 4);
  assert.strictEqual(result.rewardTotal, 4);
  assert.deepStrictEqual(result.selectedCardIndexes, [0, 1, 2, 3]);

  assert.strictEqual(gameState.dailyBonus.cardPickSession, null);
  assert.strictEqual(gameState.dailyBonus.totalGamesPlayed, 1);
  assert.strictEqual(gameState.dailyBonus.rewardsReceived, 4);
  assert.strictEqual(gameState.dailyBonus.rewardCounts.tier_1, 4);
  assert.strictEqual(gameState.dailyBonus.streak, 15);
  assert.strictEqual(gameState.dailyBonus.lastResult.gameId, CARD_PICK_GAME.id);
});

test('Card Pick daily bonus advancement starts bonus phase before completion', () => {
  const gameState = createCardPickGameState({ streak: 77 });
  const start = playDailyBonus(gameState, NOW, { randomFn: () => 0 });
  const indexes = Array.from({ length: start.session.initialPickCount }, (_, index) => index);

  assert.strictEqual(selectCardPickDailyBonusCards(gameState, indexes).success, true);
  assert.strictEqual(confirmCardPickDailyBonusSelection(gameState).success, true);
  assert.strictEqual(revealCardPickDailyBonusSelectedCards(gameState).success, true);

  const advanced = advanceCardPickDailyBonusPhase(gameState, { randomFn: () => 0.999 });

  assert.strictEqual(advanced.success, true);
  assert.strictEqual(advanced.startsBonus, true);
  assert.strictEqual(advanced.session.status, CARD_PICK_SESSION_STATUS.SELECTING);
  assert.strictEqual(advanced.session.phases.at(-1).type, 'bonus_1');
  assert.strictEqual(gameState.dailyBonus.totalGamesPlayed, 0);
  assert.strictEqual(gameState.dailyBonus.streak, 77);
});

test('Non Card Pick games still resolve through the one-shot path', () => {
  const gameState = { dailyBonus: createDailyBonusState(NOW) };

  const result = playDailyBonus(gameState, NOW, { randomFn: () => 0 });

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.gameId, 'chest_draw');
  assert.strictEqual(gameState.dailyBonus.cardPickSession, null);
  assert.strictEqual(gameState.dailyBonus.totalGamesPlayed, 1);
  assert.strictEqual(gameState.dailyBonus.rewardsReceived, 1);
  assert.strictEqual(gameState.dailyBonus.streak, 1);
});

function createCardPickGameState(options = {}) {
  const dailyBonus = createDailyBonusState(NOW);
  const slotOffset = CARD_PICK_GAME.slot - 1;

  dailyBonus.rotationAnchorUtc = getUtcBoundaryStart(NOW) - (slotOffset * DAILY_BONUS_SLOT_MS);
  dailyBonus.lastTokenBoundaryIndex = slotOffset;
  dailyBonus.dailyTokens = 1;
  dailyBonus.specialTokens = 0;
  dailyBonus.streak = Math.max(0, Number(options.streak) || 0);
  dailyBonus.lastPlayedUtcDay = null;

  return { dailyBonus };
}
