const CHECKLIST_REWARD_IDS = Object.freeze([
  'tier_1',
  'tier_1',
  'tier_1',
  'tier_2',
  'tier_2',
  'tier_2',
  'tier_3',
  'tier_3',
  'tier_3',
  'tier_4',
  'tier_4',
  'tier_4',
  'tier_5',
  'tier_6',
  'tier_7'
]);

export const CHECKLIST_TIER_COLORS = Object.freeze({
  tier_1: '#9aa7b5',
  tier_2: '#56a8ff',
  tier_3: '#52df87',
  tier_4: '#ba77ff',
  tier_5: '#ffbe4d',
  tier_6: '#ff5b8f',
  tier_7: '#ffffff'
});

const RESOURCE_CHECKLIST_REWARD_IDS = Object.freeze([...CHECKLIST_REWARD_IDS]);
const ITEM_CHECKLIST_REWARD_IDS = Object.freeze([...CHECKLIST_REWARD_IDS]);

export const RESOURCE_CHECKLIST_GAME = createChecklistGame({
  id: 'resource_checklist',
  slot: 3,
  name: 'Resource Checklist',
  checklistKey: 'resource',
  rewardIds: RESOURCE_CHECKLIST_REWARD_IDS,
  nextTitle: 'Next Resource Entry',
  rewardsTitle: 'Resource Rewards'
});

export const ITEM_CHECKLIST_GAME = createChecklistGame({
  id: 'item_checklist',
  slot: 9,
  name: 'Item Checklist',
  checklistKey: 'item',
  rewardIds: ITEM_CHECKLIST_REWARD_IDS,
  nextTitle: 'Next Item Entry',
  rewardsTitle: 'Item Rewards'
});

export const CHECKLIST_GAMES = Object.freeze([
  RESOURCE_CHECKLIST_GAME,
  ITEM_CHECKLIST_GAME
]);

export function isChecklistGame(gameOrId) {
  return Boolean(getChecklistGameById(getGameId(gameOrId)));
}

export function getChecklistGameById(gameId) {
  return CHECKLIST_GAMES.find((game) => game.id === gameId) || null;
}

export function getChecklistProgress(dailyBonusState, gameOrId) {
  const game = getChecklistGame(gameOrId);
  const nextEntryIndex = getChecklistEntryIndex(dailyBonusState, game);
  const nextEntry = game.entries[nextEntryIndex] || game.entries[0];

  return {
    game,
    entries: game.entries,
    completedCount: nextEntryIndex,
    nextEntryIndex,
    nextEntry
  };
}

export function checkOffChecklist(dailyBonusState, gameOrId) {
  const game = getChecklistGame(gameOrId);
  const entryIndex = getChecklistEntryIndex(dailyBonusState, game);
  const entry = game.entries[entryIndex] || game.entries[0];
  const nextEntryIndex = (entryIndex + 1) % game.entries.length;

  if (dailyBonusState) {
    if (!dailyBonusState.checklistEntryIndexes || typeof dailyBonusState.checklistEntryIndexes !== 'object') {
      dailyBonusState.checklistEntryIndexes = {};
    }
    dailyBonusState.checklistEntryIndexes[game.checklistKey] = nextEntryIndex;
  }

  return {
    gameId: game.id,
    slot: game.slot,
    rolls: [entry],
    checklistEntry: entry,
    entryIndex,
    entryNumber: entry.entryNumber,
    completedCountBefore: entryIndex,
    completedCountAfter: entryIndex + 1,
    nextEntryIndex,
    cycleCompleted: nextEntryIndex === 0,
    tier: entry.tier,
    rarity: `Entry ${entry.entryNumber} Complete`,
    rewardId: entry.rewardId
  };
}

export function normalizeChecklistEntryIndex(value, entryCount = CHECKLIST_REWARD_IDS.length) {
  const parsed = Math.max(0, Math.floor(Number(value) || 0));
  return parsed % Math.max(1, Math.floor(Number(entryCount) || CHECKLIST_REWARD_IDS.length));
}

function createChecklistGame(config) {
  const entries = Object.freeze(config.rewardIds.map((rewardId, index) => {
    const tier = Math.max(1, Number(rewardId.replace('tier_', '')) || 1);

    return Object.freeze({
      entryIndex: index,
      entryNumber: index + 1,
      tier,
      rewardId,
      rarity: `Checklist Entry ${index + 1}`,
      color: CHECKLIST_TIER_COLORS[rewardId] || CHECKLIST_TIER_COLORS.tier_1
    });
  }));

  return Object.freeze({
    id: config.id,
    slot: config.slot,
    name: config.name,
    checklistKey: config.checklistKey,
    nextTitle: config.nextTitle,
    rewardsTitle: config.rewardsTitle,
    entries
  });
}

function getChecklistGame(gameOrId) {
  return getChecklistGameById(getGameId(gameOrId)) || RESOURCE_CHECKLIST_GAME;
}

function getChecklistEntryIndex(dailyBonusState, game) {
  return normalizeChecklistEntryIndex(
    dailyBonusState?.checklistEntryIndexes?.[game.checklistKey],
    game.entries.length
  );
}

function getGameId(gameOrId) {
  return typeof gameOrId === 'string' ? gameOrId : gameOrId?.id;
}
