import { ACHIEVEMENT_DEFS } from './defs.js';
import { toFiniteNumber } from '../format.js';

export function createAchievementsState() {
  return {
    unlocked: {},
    unlockedCount: 0,
    totalStars: 0,
    achievementStars: {},
    viewCount: 0,
    screenViews: {
      quests: 0,
      achievements: 0,
      stats: 0
    },
    tutorialTasksCompleted: 0
  };
}

export function normalizeAchievementsState(rawState) {
  const base = createAchievementsState();
  const source = isRecord(rawState) ? rawState : {};

  const normalized = {
    ...base,
    screenViews: {
      ...base.screenViews
    }
  };

  if (isRecord(source.screenViews)) {
    for (const key of Object.keys(normalized.screenViews)) {
      normalized.screenViews[key] = Math.max(0, Math.floor(toFiniteNumber(source.screenViews[key], 0)));
    }
  }

  normalized.viewCount = Math.max(
    Math.floor(toFiniteNumber(source.viewCount, 0)),
    normalized.screenViews.quests + normalized.screenViews.achievements + normalized.screenViews.stats
  );
  normalized.tutorialTasksCompleted = Math.max(0, Math.floor(toFiniteNumber(source.tutorialTasksCompleted, 0)));

  if (isRecord(source.unlocked)) {
    for (const achievementId in ACHIEVEMENT_DEFS) {
      if (Boolean(source.unlocked[achievementId])) {
        normalized.unlocked[achievementId] = true;
      }
    }
  }

  recomputeAchievementTotals(normalized);
  return normalized;
}

export function evaluateAchievements(state) {
  const achievements = state.achievements;
  if (!achievements) return [];

  const unlockedNow = [];

  for (const achievementId in ACHIEVEMENT_DEFS) {
    const definition = ACHIEVEMENT_DEFS[achievementId];
    if (achievements.unlocked[achievementId]) {
      continue;
    }

    if (definition.condition(state)) {
      achievements.unlocked[achievementId] = true;
      achievements.achievementStars[achievementId] = definition.stars;
      unlockedNow.push({
        id: achievementId,
        name: definition.name,
        stars: definition.stars
      });
    }
  }

  if (unlockedNow.length > 0) {
    recomputeAchievementTotals(achievements);
  }

  return unlockedNow;
}

export function recordScreenView(state, screenKey) {
  const achievements = state.achievements;
  if (!achievements || !achievements.screenViews || !Object.hasOwn(achievements.screenViews, screenKey)) {
    return;
  }

  achievements.screenViews[screenKey] += 1;
  achievements.viewCount += 1;
}

function recomputeAchievementTotals(achievements) {
  achievements.unlockedCount = 0;
  achievements.totalStars = 0;
  achievements.achievementStars = {};

  for (const achievementId in ACHIEVEMENT_DEFS) {
    if (!achievements.unlocked[achievementId]) {
      continue;
    }

    const stars = ACHIEVEMENT_DEFS[achievementId].stars;
    achievements.unlockedCount += 1;
    achievements.totalStars += stars;
    achievements.achievementStars[achievementId] = stars;
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
