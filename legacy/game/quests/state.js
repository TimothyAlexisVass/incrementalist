import { MAIN_QUESTS, DAILY_QUESTS, QUEST_RANK_POINTS } from './defs.js';
import { toFiniteNumber } from '../format.js';

const MAX_QUEST_RANK = 4;

export function createQuestsState() {
  const state = {
    questTokens: 0,
    eventTokens: 0,
    questMultiplier: 0,
    mainQuests: {},
    dailyQuests: {},
    lastDailyReset: 0,
    consecutiveDays: 0,
    lastPlayDate: null
  };

  ensureMainQuestShape(state.mainQuests);
  ensureDailyQuestShape(state.dailyQuests);
  return state;
}

export function createQuestOverlayState() {
  return {
    open: false,
    panel: 'quests',
    questTab: 'main',
    highlightedShopItem: null,
    confirmModal: null,
    sisuModal: null
  };
}

export function normalizeQuestsState(rawState) {
  const base = createQuestsState();
  const source = isRecord(rawState) ? rawState : {};

  const normalized = {
    ...base,
    questTokens: Math.max(0, Math.floor(toFiniteNumber(source.questTokens, base.questTokens))),
    eventTokens: Math.max(0, Math.floor(toFiniteNumber(source.eventTokens, base.eventTokens))),
    lastDailyReset: Math.max(0, Math.floor(toFiniteNumber(source.lastDailyReset, base.lastDailyReset))),
    consecutiveDays: Math.max(0, Math.floor(toFiniteNumber(source.consecutiveDays, base.consecutiveDays))),
    lastPlayDate: typeof source.lastPlayDate === 'string' ? source.lastPlayDate : null,
    mainQuests: {},
    dailyQuests: {}
  };

  const sourceMainQuests = isRecord(source.mainQuests) ? source.mainQuests : {};
  for (const questId in MAIN_QUESTS) {
    normalized.mainQuests[questId] = clampRank(sourceMainQuests[questId]);
  }

  const sourceDailyQuests = isRecord(source.dailyQuests) ? source.dailyQuests : {};
  for (const questId in DAILY_QUESTS) {
    const sourceDaily = isRecord(sourceDailyQuests[questId]) ? sourceDailyQuests[questId] : {};
    normalized.dailyQuests[questId] = {
      progress: Math.max(0, toFiniteNumber(sourceDaily.progress, 0)),
      completed: Boolean(sourceDaily.completed),
      claimedRank: clampRank(sourceDaily.claimedRank),
      lastDaily: Math.max(0, Math.floor(toFiniteNumber(sourceDaily.lastDaily, 0)))
    };
  }

  normalized.questMultiplier = calculateQuestMultiplierFromMainQuests(normalized.mainQuests);
  return normalized;
}

export function getMainQuestRankCount(state, minimumRank) {
  let count = 0;
  const minRank = clampRank(minimumRank);

  for (const questId in MAIN_QUESTS) {
    const rank = clampRank(state.quests.mainQuests[questId]);
    if (rank >= minRank) {
      count += 1;
    }
  }

  return count;
}

export function getMainQuestProgress(state, questId) {
  switch (questId) {
    case 'level_up':
      return toFiniteNumber(state.level, 1);
    case 'achievements':
      return toFiniteNumber(state.achievements?.unlockedCount, 0);
    case 'quest_c_rank':
      return getMainQuestRankCount(state, 1);
    case 'money_coins':
      return toFiniteNumber(state.coins, 0);
    case 'money_shards':
      return toFiniteNumber(state.shards, 0);
    case 'money_cores':
      return toFiniteNumber(state.cores, 0);
    case 'progress_claim':
      return toFiniteNumber(state.progressBar?.rewardsClaimed, 0);
    default:
      return 0;
  }
}

export function getDailyQuestProgress(state, questId) {
  switch (questId) {
    case 'attendance':
      return toFiniteNumber(state.quests.consecutiveDays, 0);
    case 'level_up_daily':
      return toFiniteNumber(state.level, 1);
    default:
      return 0;
  }
}

export function refreshQuestState(state, now = Date.now()) {
  let didDailyReset = false;
  ensureMainQuestShape(state.quests.mainQuests);
  ensureDailyQuestShape(state.quests.dailyQuests);

  const dayStart = getDayStart(now);
  if (toFiniteNumber(state.quests.lastDailyReset, 0) < dayStart) {
    resetDailyQuestsForNewDay(state, now);
    didDailyReset = true;
  }

  for (const questId in DAILY_QUESTS) {
    const dailyQuest = state.quests.dailyQuests[questId];
    dailyQuest.progress = getDailyQuestProgress(state, questId);
  }

  state.quests.questMultiplier = calculateQuestMultiplierFromMainQuests(state.quests.mainQuests);

  return { didDailyReset };
}

export function calculateQuestMultiplierFromMainQuests(mainQuests) {
  let points = 0;

  for (const questId in MAIN_QUESTS) {
    const rank = clampRank(mainQuests[questId]);
    points += QUEST_RANK_POINTS[rank];
  }

  return points / 25;
}

export function claimAllQuestRewards(state, now = Date.now()) {
  ensureMainQuestShape(state.quests.mainQuests);
  ensureDailyQuestShape(state.quests.dailyQuests);

  const summary = {
    claimedAny: false,
    mainClaims: [],
    dailyClaims: [],
    totalQuestTokens: 0,
    totalEventTokens: 0
  };

  for (const [questId, questDef] of Object.entries(MAIN_QUESTS)) {
    let currentRank = clampRank(state.quests.mainQuests[questId]);

    for (let rank = currentRank + 1; rank <= MAX_QUEST_RANK; rank += 1) {
      const rankDef = questDef.ranks[rank];
      const progress = getMainQuestProgress(state, questId);
      if (progress < rankDef.requirement) {
        break;
      }

      state.quests.mainQuests[questId] = rank;
      currentRank = rank;
      state.quests.questTokens += rankDef.reward;
      summary.totalQuestTokens += rankDef.reward;
      summary.mainClaims.push({
        questId,
        questName: questDef.name,
        rank,
        reward: rankDef.reward
      });
    }
  }

  for (const [questId, questDef] of Object.entries(DAILY_QUESTS)) {
    const dailyQuestState = state.quests.dailyQuests[questId];
    let currentRank = clampRank(dailyQuestState.claimedRank);

    for (let rank = currentRank + 1; rank <= MAX_QUEST_RANK; rank += 1) {
      const rankDef = questDef.ranks[rank];
      const progress = getDailyQuestProgress(state, questId);
      if (progress < rankDef.requirement) {
        break;
      }

      dailyQuestState.claimedRank = rank;
      currentRank = rank;
      dailyQuestState.completed = rank >= MAX_QUEST_RANK;
      dailyQuestState.lastDaily = now;
      dailyQuestState.progress = progress;

      state.quests.questTokens += rankDef.reward;
      state.quests.eventTokens += rankDef.reward;
      summary.totalQuestTokens += rankDef.reward;
      summary.totalEventTokens += rankDef.reward;
      summary.dailyClaims.push({
        questId,
        questName: questDef.name,
        rank,
        reward: rankDef.reward
      });
    }
  }

  summary.claimedAny = summary.mainClaims.length > 0 || summary.dailyClaims.length > 0;

  if (summary.claimedAny) {
    state.quests.questMultiplier = calculateQuestMultiplierFromMainQuests(state.quests.mainQuests);
  }

  return summary;
}

export function claimQuestReward(state, questTab, questId, now = Date.now()) {
  ensureMainQuestShape(state.quests.mainQuests);
  ensureDailyQuestShape(state.quests.dailyQuests);

  const summary = {
    claimedAny: false,
    mainClaims: [],
    dailyClaims: [],
    totalQuestTokens: 0,
    totalEventTokens: 0
  };

  if (questTab === 'daily') {
    const questDef = DAILY_QUESTS[questId];
    const dailyQuestState = state.quests.dailyQuests[questId];
    if (!questDef || !dailyQuestState) {
      return summary;
    }

    const currentRank = clampRank(dailyQuestState.claimedRank);
    if (currentRank >= MAX_QUEST_RANK) {
      return summary;
    }

    const nextRank = currentRank + 1;
    const rankDef = questDef.ranks[nextRank];
    const progress = getDailyQuestProgress(state, questId);
    if (!rankDef || progress < rankDef.requirement) {
      return summary;
    }

    dailyQuestState.claimedRank = nextRank;
    dailyQuestState.completed = nextRank >= MAX_QUEST_RANK;
    dailyQuestState.lastDaily = now;
    dailyQuestState.progress = progress;

    state.quests.questTokens += rankDef.reward;
    state.quests.eventTokens += rankDef.reward;
    summary.claimedAny = true;
    summary.totalQuestTokens = rankDef.reward;
    summary.totalEventTokens = rankDef.reward;
    summary.dailyClaims.push({
      questId,
      questName: questDef.name,
      rank: nextRank,
      reward: rankDef.reward
    });

    return summary;
  }

  const questDef = MAIN_QUESTS[questId];
  if (!questDef) {
    return summary;
  }

  const currentRank = clampRank(state.quests.mainQuests[questId]);
  if (currentRank >= MAX_QUEST_RANK) {
    return summary;
  }

  const nextRank = currentRank + 1;
  const rankDef = questDef.ranks[nextRank];
  const progress = getMainQuestProgress(state, questId);
  if (!rankDef || progress < rankDef.requirement) {
    return summary;
  }

  state.quests.mainQuests[questId] = nextRank;
  state.quests.questTokens += rankDef.reward;
  state.quests.questMultiplier = calculateQuestMultiplierFromMainQuests(state.quests.mainQuests);

  summary.claimedAny = true;
  summary.totalQuestTokens = rankDef.reward;
  summary.mainClaims.push({
    questId,
    questName: questDef.name,
    rank: nextRank,
    reward: rankDef.reward
  });

  return summary;
}

export function updateRewardMultiplier(state) {
  const achievementBonus = toFiniteNumber(state.achievements?.totalStars, 0);
  const questBonus = toFiniteNumber(state.quests?.questMultiplier, 0);
  state.progressBar.rewardMultiplier = 1 + ((achievementBonus + questBonus) / 100);
  return state.progressBar.rewardMultiplier;
}

function ensureMainQuestShape(mainQuests) {
  for (const questId in MAIN_QUESTS) {
    if (!Object.hasOwn(mainQuests, questId)) {
      mainQuests[questId] = 0;
    } else {
      mainQuests[questId] = clampRank(mainQuests[questId]);
    }
  }
}

function ensureDailyQuestShape(dailyQuests) {
  for (const questId in DAILY_QUESTS) {
    if (!isRecord(dailyQuests[questId])) {
      dailyQuests[questId] = {
        progress: 0,
        completed: false,
        claimedRank: 0,
        lastDaily: 0
      };
      continue;
    }

    const dailyQuest = dailyQuests[questId];
    dailyQuest.progress = Math.max(0, toFiniteNumber(dailyQuest.progress, 0));
    dailyQuest.completed = Boolean(dailyQuest.completed);
    dailyQuest.claimedRank = clampRank(dailyQuest.claimedRank);
    dailyQuest.lastDaily = Math.max(0, Math.floor(toFiniteNumber(dailyQuest.lastDaily, 0)));
  }
}

function resetDailyQuestsForNewDay(state, now) {
  for (const questId in DAILY_QUESTS) {
    const dailyQuest = state.quests.dailyQuests[questId];
    dailyQuest.progress = 0;
    dailyQuest.completed = false;
    dailyQuest.claimedRank = 0;
    dailyQuest.lastDaily = now;
  }

  const todayStamp = getDayStamp(now);
  const yesterdayStamp = getDayStamp(now - 86400000);
  const previousPlayDate = state.quests.lastPlayDate;

  if (previousPlayDate === yesterdayStamp) {
    state.quests.consecutiveDays = Math.max(1, toFiniteNumber(state.quests.consecutiveDays, 0) + 1);
  } else if (previousPlayDate === todayStamp) {
    state.quests.consecutiveDays = Math.max(1, toFiniteNumber(state.quests.consecutiveDays, 0));
  } else {
    state.quests.consecutiveDays = 1;
  }

  state.quests.lastPlayDate = todayStamp;
  state.quests.lastDailyReset = now;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampRank(value) {
  return clamp(Math.floor(toFiniteNumber(value, 0)), 0, MAX_QUEST_RANK);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getDayStart(now) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function getDayStamp(now) {
  return new Date(now).toDateString();
}
