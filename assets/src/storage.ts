import {
  SAVE_KEY,
  SAVE_KEY_PREFIX,
  GLOBAL_OPTIONS_KEY,
  MAX_SAVEFILES
} from './config.js';
import {
  normalizeAchievementsState
} from './achievements/evaluate.js';
import { normalizeQuestsState, updateRewardMultiplier } from './quests/state.js';
import { normalizeDailyBonusState, refreshDailyBonusState } from './daily-bonus/state.js';
import { createSisuState, normalizeSisuState } from './sisu/state.js';
import { applyLevelUps, ensureFirstPlayedAt, updateRequiredExp } from './progression.js';
import { createGlobalOptionsState } from './state.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getSaveKey(fileIndex) {
  return `${SAVE_KEY_PREFIX}${fileIndex}`;
}

export function loadGlobalOptions() {
  try {
    const data = localStorage.getItem(GLOBAL_OPTIONS_KEY);
    return data ? JSON.parse(data) : createGlobalOptionsState();
  } catch {
    return createGlobalOptionsState();
  }
}

export function saveGlobalOptions(globalOptions) {
  try {
    localStorage.setItem(GLOBAL_OPTIONS_KEY, JSON.stringify(globalOptions));
  } catch (error) {
    console.warn('Failed to save global options:', error);
  }
}

export function checkHasSaveData(fileIndex) {
  const key = getSaveKey(fileIndex);
  try {
    const data = localStorage.getItem(key);
    if (!data) return false;
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    return Number.isFinite(Number(parsed.level));
  } catch {
    return false;
  }
}

export function checkAnySaveDataExists() {
  for (let i = 0; i < MAX_SAVEFILES; i += 1) {
    if (checkHasSaveData(i)) {
      return true;
    }
  }
  return false;
}

export function getAutoSelectFile() {
  const globalOptions = loadGlobalOptions();
  const fileIndex = globalOptions.lastSavefile;
  if (fileIndex >= 0 && fileIndex < MAX_SAVEFILES && checkHasSaveData(fileIndex)) {
    return fileIndex;
  }
  return -1;
}

export function loadSavefileData(fileIndex) {
  const key = getSaveKey(fileIndex);
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveToFile(fileIndex, state) {
  const key = getSaveKey(fileIndex);
  const saveData = {
    level: state.level,
    exp: state.exp,
    coins: state.coins,
    shards: state.shards,
    cores: state.cores,
    progressBar: state.progressBar,
    achievements: state.achievements,
    quests: state.quests,
    dailyBonus: state.dailyBonus,
    idleMode: state.idleMode,
    firstPlayedAt: state.firstPlayedAt,
    features: state.features,
    sisu: state.sisu,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(key, JSON.stringify(saveData));
  } catch (error) {
    console.warn(`Failed to save to file ${fileIndex}:`, error);
  }
}

export function saveGame(state) {
  const saveData = {
    level: state.level,
    exp: state.exp,
    coins: state.coins,
    shards: state.shards,
    cores: state.cores,
    progressBar: state.progressBar,
    achievements: state.achievements,
    quests: state.quests,
    dailyBonus: state.dailyBonus,
    idleMode: state.idleMode,
    firstPlayedAt: state.firstPlayedAt,
    features: state.features,
    sisu: state.sisu,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (error) {
    console.warn('Failed to save game:', error);
  }
}

export function deleteSavefile(fileIndex) {
  const key = getSaveKey(fileIndex);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to delete save file ${fileIndex}:`, error);
  }
}

function applyLoadedGameData(state, data) {
  state.level = Number(data.level) || 1;
  state.exp = Number(data.exp) || 0;
  state.coins = Number(data.coins) || 0;
  state.shards = Number(data.shards) || 0;
  state.cores = Number(data.cores) || 0;

  const savedFirstPlayedAt = Number(data.firstPlayedAt);
  const savedAt = Number(data.savedAt);
  if (Number.isFinite(savedFirstPlayedAt) && savedFirstPlayedAt > 0) {
    state.firstPlayedAt = savedFirstPlayedAt;
  } else if (Number.isFinite(savedAt) && savedAt > 0) {
    state.firstPlayedAt = savedAt;
  }

  if (data.progressBar) {
    state.progressBar.fill = clamp(Number(data.progressBar.fill) || 0, 0, 100);
    state.progressBar.sisu = Number(data.progressBar.sisu) || 1;
    state.progressBar.rewardMultiplier = Number(data.progressBar.rewardMultiplier) || 1.0;
    state.progressBar.rewardsClaimed = Number(data.progressBar.rewardsClaimed) || 0;
  }

  state.idleMode = Boolean(data.idleMode);
  state.achievements = normalizeAchievementsState(data.achievements ?? state.achievements);
  state.quests = normalizeQuestsState(data.quests ?? state.quests);
  state.dailyBonus = normalizeDailyBonusState(data.dailyBonus ?? state.dailyBonus);
  refreshDailyBonusState(state.dailyBonus);

  if (data.features) {
    state.features = {
      idleModePurchased: Boolean(data.features.idleModePurchased),
      worldMapUnlocked: Boolean(data.features.worldMapUnlocked),
      sisuGeneratorPurchased: Boolean(data.features.sisuGeneratorPurchased),
      bonusTimePurchased: Boolean(data.features.bonusTimePurchased)
    };
  } else {
    state.features = {
      idleModePurchased: false,
      worldMapUnlocked: false,
      sisuGeneratorPurchased: false,
      bonusTimePurchased: false
    };
  }

  if (data.sisu) {
    state.sisu = normalizeSisuState(data.sisu, state.progressBar.sisu);
    state.progressBar.sisu = state.sisu.current;
  } else {
    state.sisu = createSisuState();
    state.progressBar.sisu = 1;
  }

  ensureFirstPlayedAt(state);
  updateRequiredExp(state);
  applyLevelUps(state);
  updateRewardMultiplier(state);

  state.canClaim = state.progressBar.fill >= 100;
  state.justClaimed = false;
}

export function loadGame(state, fileIndex = state?.fileIndex) {
  const keysToTry = [];
  const normalizedFileIndex = Math.floor(Number(fileIndex));
  if (Number.isInteger(normalizedFileIndex) && normalizedFileIndex >= 0 && normalizedFileIndex < MAX_SAVEFILES) {
    keysToTry.push(getSaveKey(normalizedFileIndex));
  }
  keysToTry.push(SAVE_KEY);

  for (const key of keysToTry) {
    try {
      const savedData = localStorage.getItem(key);
      if (!savedData) {
        continue;
      }

      const data = JSON.parse(savedData);
      applyLoadedGameData(state, data);
      console.log(`Game loaded successfully from ${key}`);
      return true;
    } catch (error) {
      console.warn(`Failed to load game from ${key}:`, error);
    }
  }

  return false;
}
