import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_PICK_BOARD_COLS,
  CARD_PICK_BOARD_ROWS,
  CARD_PICK_CARD_COUNT,
  CARD_PICK_SESSION_STATUS,
  advanceCardPickRevealedPhase,
  confirmCardPickSelection,
  getCardPickCount,
  getCardPickInitialBonusChance,
  getCardPickRewardSummary,
  getCurrentCardPickPhase,
  pickCardPickCard,
  revealCardPickMissedCards,
  revealCardPickSelectedCards,
  rollCardPick,
  startCardPickBonusPhase
} from './index.js';

test('Card Pick uses the locked board contract', () => {
  assert.strictEqual(CARD_PICK_BOARD_COLS, 6);
  assert.strictEqual(CARD_PICK_BOARD_ROWS, 6);
  assert.strictEqual(CARD_PICK_CARD_COUNT, 36);

  const result = rollCardPick(0, () => 0.99);

  assert.strictEqual(result.initialBoard.length, CARD_PICK_CARD_COUNT);
  assert.strictEqual(result.selectedCardIndexes.length, 0);
  assert.strictEqual(result.initialPickCount, 2);
  assert.strictEqual(result.requiredPickCount, 2);
  assert.strictEqual(result.status, CARD_PICK_SESSION_STATUS.SELECTING);
});

test('Card Pick starts with 2 picks and caps at 9', () => {
  assert.strictEqual(getCardPickCount(-1), 2);
  assert.strictEqual(getCardPickCount(0), 2);
  assert.strictEqual(getCardPickCount(6), 2);
  assert.strictEqual(getCardPickCount(7), 3);
  assert.strictEqual(getCardPickCount(13), 3);
  assert.strictEqual(getCardPickCount(14), 4);
  assert.strictEqual(getCardPickCount(48), 8);
  assert.strictEqual(getCardPickCount(49), 9);
  assert.strictEqual(getCardPickCount(77), 9);
});

test('Card Pick starts with the initial pick count and no preselected cards', () => {
  const result = rollCardPick(14, () => 0.99);
  const phase = getCurrentCardPickPhase(result);

  assert.strictEqual(phase.type, 'initial');
  assert.strictEqual(phase.pickCount, 4);
  assert.strictEqual(result.selectedCardIndexes.length, 0);
  assert.deepStrictEqual(result.rolls, []);
});

test('Card Pick selection resolves only after confirm and reveal actions', () => {
  const session = rollCardPick(7, () => 0);

  assert.strictEqual(confirmCardPickSelection(session, [0, 1]).success, false);
  assert.strictEqual(confirmCardPickSelection(session, [0, 1, 2]).success, true);
  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.SELECTION_CONFIRMED);
  assert.deepStrictEqual(session.rolls, []);

  const selectedReveal = revealCardPickSelectedCards(session);
  assert.strictEqual(selectedReveal.success, true);
  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.SELECTED_REVEALED);
  assert.strictEqual(session.rolls.length, 3);
  assert.deepStrictEqual(session.selectedCardIndexes, [0, 1, 2]);

  const missedReveal = revealCardPickMissedCards(session);
  assert.strictEqual(missedReveal.success, true);
  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.MISSED_REVEALED);
  assert.strictEqual(session.missedCardIndexes.length, CARD_PICK_CARD_COUNT - 3);
});

test('Card Pick can reveal cards as they are picked from the board', () => {
  const session = rollCardPick(0, () => 0.7);

  const firstPick = pickCardPickCard(session, 5);
  assert.strictEqual(firstPick.success, true);
  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.SELECTING);
  assert.deepStrictEqual(session.selectedCardIndexes, [5]);
  assert.strictEqual(session.rolls.length, 1);
  assert.strictEqual(session.rolls[0].cardIndex, 5);
  assert.strictEqual(session.initialBoard[5].revealed, true);

  assert.strictEqual(pickCardPickCard(session, 5).success, false);

  const secondPick = pickCardPickCard(session, 8);
  assert.strictEqual(secondPick.success, true);
  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.SELECTED_REVEALED);
  assert.deepStrictEqual(session.selectedCardIndexes, [5, 8]);
  assert.strictEqual(session.rolls.length, 2);
});

test('Card Pick reward summary is derived from chosen board cards', () => {
  const rolls = [0.1, 0.7, 0.9, 0.99];
  const session = rollCardPick(0, () => rolls.shift() ?? 0.1);

  assert.strictEqual(session.initialBoard[0].rewardId, 'tier_1');
  assert.strictEqual(session.initialBoard[1].rewardId, 'tier_2');
  assert.strictEqual(pickCardPickCard(session, 1).success, true);
  assert.strictEqual(pickCardPickCard(session, 0).success, true);

  const summary = getCardPickRewardSummary(session);
  assert.deepStrictEqual(summary.selectedCardIndexes, [1, 0]);
  assert.strictEqual(summary.rewardCounts.tier_2, 1);
  assert.strictEqual(summary.rewardCounts.tier_1, 1);
  assert.strictEqual(summary.rewardTotal, 2);
  assert.strictEqual(summary.rewardId, 'tier_2');
});

test('Card Pick bonus phases double rewards through board state', () => {
  const session = rollCardPick(0, () => 0.1);

  assert.strictEqual(pickCardPickCard(session, 0).success, true);
  assert.strictEqual(pickCardPickCard(session, 1).success, true);
  assert.strictEqual(startCardPickBonusPhase(session, { pickCount: 1, randomFn: () => 0 }).success, true);

  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.SELECTING);
  assert.strictEqual(session.initialBoard[2].multiplier, 2);
  assert.strictEqual(pickCardPickCard(session, 2).success, true);
  assert.strictEqual(session.rolls.at(-1).multiplier, 2);

  const summary = getCardPickRewardSummary(session);
  assert.strictEqual(summary.rewardTotal, 4);
});

test('Card Pick initial bonus chance reaches guaranteed bonus at streak 77', () => {
  assert.strictEqual(getCardPickInitialBonusChance(0), 0.2);
  assert.strictEqual(getCardPickInitialBonusChance(77), 1);

  const session = rollCardPick(77, () => 0.1);
  for (let index = 0; index < session.initialPickCount; index += 1) {
    assert.strictEqual(pickCardPickCard(session, index).success, true);
  }

  const advanced = advanceCardPickRevealedPhase(session, { randomFn: () => 0.999 });
  const phase = getCurrentCardPickPhase(session);

  assert.strictEqual(advanced.success, true);
  assert.strictEqual(advanced.startsBonus, true);
  assert.strictEqual(phase.type, 'bonus_1');
  assert.strictEqual(phase.pickCount, 1);
  assert.strictEqual(phase.multiplier, 2);
  assert.strictEqual(session.bonusRolls.at(-1).chanceType, 'initial');
  assert.strictEqual(session.bonusRolls.at(-1).success, true);
  assert.strictEqual(session.phases[0].revealedMissed, true);
});

test('Card Pick bonus pick can chain into the fixed second bonus chance', () => {
  const session = rollCardPick(0, () => 0.1);

  pickInitialCards(session);
  assert.strictEqual(advanceCardPickRevealedPhase(session, { randomFn: () => 0 }).startsBonus, true);
  assert.strictEqual(getCurrentCardPickPhase(session).type, 'bonus_1');

  assert.strictEqual(pickCardPickCard(session, getFirstAvailableCardIndex(session)).success, true);
  const second = advanceCardPickRevealedPhase(session, { randomFn: () => 0.09 });
  const phase = getCurrentCardPickPhase(session);

  assert.strictEqual(second.success, true);
  assert.strictEqual(second.startsBonus, true);
  assert.strictEqual(phase.type, 'bonus_2');
  assert.strictEqual(phase.pickCount, 1);
  assert.strictEqual(phase.multiplier, 4);
  assert.strictEqual(session.bonusRolls.at(-1).chanceType, 'second');
});

test('Card Pick consecutive bonus phase hides picks until the rolled chain resolves', () => {
  const session = rollCardPick(0, () => 0.1);

  pickInitialCards(session);
  assert.strictEqual(advanceCardPickRevealedPhase(session, { randomFn: () => 0 }).startsBonus, true);
  assert.strictEqual(pickCardPickCard(session, getFirstAvailableCardIndex(session)).success, true);
  assert.strictEqual(advanceCardPickRevealedPhase(session, { randomFn: () => 0.09 }).startsBonus, true);
  assert.strictEqual(pickCardPickCard(session, getFirstAvailableCardIndex(session)).success, true);

  const bonusRolls = [0.01, 0.04, 0.99];
  const consecutive = advanceCardPickRevealedPhase(session, {
    randomFn: () => bonusRolls.shift() ?? 0.99
  });
  const phase = getCurrentCardPickPhase(session);
  const rollCountBeforeHiddenPicks = session.rolls.length;

  assert.strictEqual(consecutive.success, true);
  assert.strictEqual(consecutive.startsBonus, true);
  assert.strictEqual(phase.type, 'bonus_consecutive');
  assert.strictEqual(phase.pickCount, 2);
  assert.strictEqual(phase.multiplier, 4);
  assert.strictEqual(phase.revealOnPick, false);

  const firstHiddenIndex = getFirstAvailableCardIndex(session);
  assert.strictEqual(pickCardPickCard(session, firstHiddenIndex).success, true);
  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.SELECTING);
  assert.strictEqual(session.rolls.length, rollCountBeforeHiddenPicks);
  assert.strictEqual(session.initialBoard[firstHiddenIndex].selected, true);
  assert.strictEqual(session.initialBoard[firstHiddenIndex].revealed, false);

  const secondHiddenIndex = getFirstAvailableCardIndex(session);
  assert.strictEqual(pickCardPickCard(session, secondHiddenIndex).success, true);
  assert.strictEqual(session.status, CARD_PICK_SESSION_STATUS.SELECTED_REVEALED);
  assert.strictEqual(session.rolls.length, rollCountBeforeHiddenPicks + 2);
});

function pickInitialCards(session) {
  for (let index = 0; index < session.initialPickCount; index += 1) {
    assert.strictEqual(pickCardPickCard(session, index).success, true);
  }
}

function getFirstAvailableCardIndex(session) {
  const phase = getCurrentCardPickPhase(session);
  const unavailable = new Set([
    ...(session.resolvedCardIndexes || []),
    ...(phase?.selectedCardIndexes || [])
  ]);

  for (let index = 0; index < CARD_PICK_CARD_COUNT; index += 1) {
    if (!unavailable.has(index)) {
      return index;
    }
  }

  throw new Error('Expected an available Card Pick card');
}
