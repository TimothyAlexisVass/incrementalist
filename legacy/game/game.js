import {
  claimAllQuestRewards,
  claimQuestReward,
  createQuestOverlayState,
  refreshQuestState,
  updateRewardMultiplier
} from './quests/state.js';
import { evaluateAchievements, recordScreenView } from './achievements/evaluate.js';
import { renderOverlay, resolveOverlayAction } from './ui/overlay.js';
import { drawTooltip } from './ui/components.js';
import { applyCssThemeVariables, COLORS } from './colors.js';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_HEIGHT,
  MAX_SAVEFILES,
  REWARD_POPUP_HOLD_MS,
  REWARD_POPUP_HOLD_RISE_SPEED,
  ACHIEVEMENT_ANNOUNCEMENT_FONT,
  ACHIEVEMENT_ANNOUNCEMENT_LIFE_MS,
  ACHIEVEMENT_FLOAT_RISE_SPEED,
  TOP_HUD_EXP_BAR_HEIGHT,
  TOP_HUD_EXP_BAR_X,
  TOP_HUD_EXP_BAR_Y,
  REWARD_POPUP_FONT,
  BONUS_TEXT_FONT,
  UI_MESSAGE_FONT,
  UI_MESSAGE_SMALL_FONT,
  SMALL_TEXT_FONT,
} from './config.js';
import {
  addDebugDailyBonusToken,
  cycleDebugBonusSlot,
  handleDebugKeydown,
  renderDebugMenu,
  resolveDebugMenuAction
} from './debug.js';
import {
  createFloatingTextState,
  createParticleState,
  spawnClickParticleBurst,
  spawnFloatingText,
  spawnRewardPopup,
  updateFloatingTexts,
  updateParticles
} from './effects.js';
import { claimReward, updateProgressBar } from './progress-bar/mechanics.js';
import {
  getProgressBarLayout,
  renderIdleModeToggle,
  getIdleModeToggleRect,
  triggerProgressBarCollectionEffect
} from './progress-bar/render.js';
import { applyLevelUps, ensureFirstPlayedAt, updateRequiredExp } from './progression.js';
import { getBottomHudButtonRects, renderGame, renderAreaDropdown, triggerExpBarLevelUpEffect } from './render.js';
import { createGameState } from './state.js';
import {
  purchaseMaxSisuUpgrade,
  refillSisu,
  updateSisuDecay
} from './sisu/mechanics.js';
import {
  renderSisuGeneratorModal,
  renderSisuUI,
  resolveSisuGeneratorModalAction
} from './sisu/render.js';
import {
  formatSisuMultiplier,
  formatInteger,
  formatSignedNumber,
  formatSignedNumberWithUnit,
  formatSignedPercent
} from './format.js';
import {
  FEATURE_SHOP_ID,
  purchaseItem
} from './shop.js';
import {
  createShopItemHighlight,
  getLockedElementUnlockDestination,
  LOCKED_ELEMENT_IDS
} from './locked-elements.js';
import {
  advanceCardPickDailyBonusPhase,
  completeCardPickDailyBonusSession,
  pickCardPickDailyBonusCard,
  playDailyBonus
} from './daily-bonus/evaluate.js';
import {
  CARD_PICK_GAME,
  CARD_PICK_SESSION_STATUS
} from './daily-bonus/games/card-pick/index.js';
import {
  getDailyBonusRotation,
  refreshDailyBonusState
} from './daily-bonus/state.js';
import { renderDailyBonusModal, resolveDailyBonusModalAction } from './daily-bonus/render.js';
import { startCoinRainRender, renderCoinRain } from './daily-bonus/games/coin-rain/render.js';
import { evaluateCoinRainResults } from './daily-bonus/games/coin-rain/index.js';
import {
  loadGame,
  loadGlobalOptions,
  saveGlobalOptions,
  loadSavefileData,
  checkAnySaveDataExists,
  checkHasSaveData,
  getAutoSelectFile,
  saveToFile,
  deleteSavefile
} from './storage.js';
import {
  initWebGLEffectsLayer,
  renderWebGLEffects,
  spawnGpuClickBurst,
  updateWebGLEffects
} from './webgl-effects.js';

const gameState = createGameState();
const floatingTexts = createFloatingTextState();
const clickParticles = createParticleState();
const questOverlay = createQuestOverlayState();

let lastTick = 0;
let canvas = null;
let effectsCanvas = null;
let ctx = null;
let overlayLayout = null;
let sisuControlLayout = null;
let sisuModalLayout = null;
let dailyBonusModalLayout = null;
let debugMenuLayout = null;
let areaDropdownLayout = null;
let lastMousePoint = null;
const areaDropdown = {
  open: false
};
let nextLevelUpNoticeGroupId = 1;
let nextAchievementNoticeGroupId = 1;
const dailyBonusModal = {
  open: false,
  result: null,
  openedAt: 0,
  message: '',
  messageAt: 0,
  activeGameRender: null,
  cardPickSession: null,
  cardPickSelectedIndexes: [],
  cardPickCurrentPhaseIndex: 0,
  cardPickRevealAt: 0
};

export function getGameMousePoint() {
  return lastMousePoint;
}

function createCanvasIfNeeded() {
  const stage = createGameStageIfNeeded();
  canvas = document.getElementById('gameCanvas');

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    stage.appendChild(canvas);
  } else if (canvas.parentElement !== stage) {
    stage.appendChild(canvas);
  }

  if (!canvas.width) {
    canvas.width = CANVAS_WIDTH;
  }

  if (!canvas.height) {
    canvas.height = CANVAS_HEIGHT;
  }

  effectsCanvas = document.getElementById('effectsCanvas');

  if (!effectsCanvas) {
    effectsCanvas = document.createElement('canvas');
    effectsCanvas.id = 'effectsCanvas';
    effectsCanvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(effectsCanvas);
  } else if (effectsCanvas.parentElement !== stage) {
    stage.appendChild(effectsCanvas);
  }

  effectsCanvas.width = canvas.width;
  effectsCanvas.height = canvas.height;
  initWebGLEffectsLayer(effectsCanvas, canvas.width, canvas.height);

  ctx = canvas.getContext('2d');
}

function createGameStageIfNeeded() {
  let stage = document.getElementById('gameStage');
  if (stage) {
    return stage;
  }

  stage = document.createElement('div');
  stage.id = 'gameStage';

  const existingCanvas = document.getElementById('gameCanvas');
  if (existingCanvas?.parentNode) {
    existingCanvas.parentNode.insertBefore(stage, existingCanvas);
    stage.appendChild(existingCanvas);
  } else {
    document.body.appendChild(stage);
  }

  return stage;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseFontSizePx(font) {
  const match = /(\d+(?:\.\d+)?)px/.exec(font || '');
  if (!match) {
    return 16;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 16;
}

function clampPointToCanvas(point, margin = 108) {
  const minX = DISPLAY_AREA_X + margin;
  const maxX = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - margin;

  const minY = DISPLAY_AREA_Y + margin;
  const maxY = DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT - margin / 3;

  return {
    x: clamp(
      point?.x ?? (DISPLAY_AREA_X + DISPLAY_AREA_WIDTH / 2),
      minX,
      maxX
    ),
    y: clamp(
      point?.y ?? (DISPLAY_AREA_Y + DISPLAY_AREA_HEIGHT / 2),
      minY,
      maxY
    )
  };
}

function measureTextWidth(text, font) {
  const fallbackFontSize = parseFontSizePx(font);
  let width = Math.max(0, String(text ?? '').length * (fallbackFontSize * 0.55));

  if (ctx) {
    ctx.save();
    ctx.font = font;
    width = ctx.measureText(String(text ?? '')).width;
    ctx.restore();
  }

  return width;
}

function getCenteredPopupAnchorBounds(text, font, offsetX, offsetY, margin = 8) {
  const fontSize = parseFontSizePx(font);
  const textWidth = measureTextWidth(text, font);
  const halfWidth = textWidth / 2;
  const bottomPadding = Math.max(6, Math.round(fontSize * 0.3));

  return {
    minX: margin + halfWidth - offsetX,
    maxX: canvas.width - margin - halfWidth - offsetX,
    minY: margin + fontSize - offsetY,
    maxY: canvas.height - margin - bottomPadding - offsetY
  };
}

function clampRewardAnchorToCanvas(point, entries) {
  if (!canvas) {
    return {
      x: point?.x ?? 0,
      y: point?.y ?? 0
    };
  }

  let minX = Number.NEGATIVE_INFINITY;
  let maxX = Number.POSITIVE_INFINITY;
  let minY = Number.NEGATIVE_INFINITY;
  let maxY = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const bounds = getCenteredPopupAnchorBounds(entry.text, entry.font, entry.offsetX, entry.offsetY);
    minX = Math.max(minX, bounds.minX);
    maxX = Math.min(maxX, bounds.maxX);
    minY = Math.max(minY, bounds.minY);
    maxY = Math.min(maxY, bounds.maxY);
  }

  if (maxX < minX) {
    minX = canvas.width / 2;
    maxX = canvas.width / 2;
  }

  if (maxY < minY) {
    minY = canvas.height / 2;
    maxY = canvas.height / 2;
  }

  return {
    x: clamp(point?.x ?? (canvas.width / 2), minX, maxX),
    y: clamp(point?.y ?? (canvas.height / 2), minY, maxY)
  };
}

function pointInRect(rect, x, y) {
  return Boolean(rect)
    && x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}

function getAvailableNoticeGroupIndexes(type, count) {
  const occupiedIndexes = new Set();

  for (const floatingText of floatingTexts) {
    if (
      floatingText.type === type
      && floatingText.stackGroupId !== null
      && Number.isFinite(floatingText.stackIndex)
    ) {
      occupiedIndexes.add(floatingText.stackIndex);
    }
  }

  const indexes = [];
  let nextIndex = 0;

  while (indexes.length < count) {
    if (!occupiedIndexes.has(nextIndex)) {
      indexes.push(nextIndex);
      occupiedIndexes.add(nextIndex);
    }

    nextIndex += 1;
  }

  return indexes;
}

function spawnLevelUpEffects(levelUps) {
  if (!canvas || levelUps.length === 0) return;

  triggerExpBarLevelUpEffect();

  const popupLifeMs = ACHIEVEMENT_ANNOUNCEMENT_LIFE_MS;
  const popupRiseSpeed = ACHIEVEMENT_FLOAT_RISE_SPEED;
  const baseX = TOP_HUD_EXP_BAR_X + 8;
  const baseY = TOP_HUD_EXP_BAR_Y + TOP_HUD_EXP_BAR_HEIGHT + 52;
  const lineStep = 30;
  const groupStep = 108;
  const groupIndexes = getAvailableNoticeGroupIndexes('level_up', levelUps.length);

  for (let i = 0; i < levelUps.length; i += 1) {
    const levelUp = levelUps[i];
    const groupId = nextLevelUpNoticeGroupId;
    const groupIndex = groupIndexes[i];
    nextLevelUpNoticeGroupId += 1;

    const popupOptions = {
      lifeMs: popupLifeMs,
      riseSpeed: popupRiseSpeed,
      font: REWARD_POPUP_FONT,
      textAlign: 'left',
      type: 'level_up',
      stackGroupId: groupId,
      stackIndex: groupIndex
    };
    const baseLineY = baseY + (groupIndex * groupStep);
    const levelText = `Level Up!`;
    const coinText = formatSignedNumber(levelUp.rewards.coins);
    const shardText = formatSignedNumber(levelUp.rewards.shards);
    const coreText = formatSignedNumber(levelUp.rewards.cores);

    spawnFloatingText(
      floatingTexts,
      levelText,
      baseX,
      baseLineY,
      COLORS.rewards.achievement,
      popupOptions
    );
    spawnFloatingText(
      floatingTexts,
      coinText,
      baseX,
      baseLineY + lineStep,
      COLORS.rewards.coins,
      popupOptions
    );

    if (levelUp.rewards.shards > 0) {
      spawnFloatingText(
        floatingTexts,
        shardText,
        baseX,
        baseLineY + (lineStep * 2),
        COLORS.rewards.shards,
        popupOptions
      );
    }

    if (levelUp.rewards.cores > 0) {
      spawnFloatingText(
        floatingTexts,
        coreText,
        baseX,
        baseLineY + (lineStep * 3),
        COLORS.rewards.cores,
        popupOptions
      );
    }
  }
}

function spawnAchievementEffects(unlockedAchievements) {
  if (!canvas || unlockedAchievements.length === 0) return;

  const groupIndexes = getAvailableNoticeGroupIndexes('achievement', unlockedAchievements.length);

  for (let i = 0; i < unlockedAchievements.length; i += 1) {
    const achievement = unlockedAchievements[i];
    const groupId = nextAchievementNoticeGroupId;
    const groupIndex = groupIndexes[i];
    nextAchievementNoticeGroupId += 1;

    spawnFloatingText(
      floatingTexts,
      `Achievement: ${achievement.name} (${formatSignedPercent(achievement.stars)})`,
      canvas.width / 2,
      80 + (groupIndex * 50),
      COLORS.rewards.achievement,
      {
        lifeMs: ACHIEVEMENT_ANNOUNCEMENT_LIFE_MS,
        riseSpeed: ACHIEVEMENT_FLOAT_RISE_SPEED,
        font: ACHIEVEMENT_ANNOUNCEMENT_FONT,
        textAlign: 'center',
        type: 'achievement',
        stackGroupId: groupId,
        stackIndex: groupIndex
      }
    );
  }
}

function evaluateAndRenderAchievements() {
  const unlocked = evaluateAchievements(gameState);
  if (unlocked.length === 0) {
    return false;
  }

  updateRewardMultiplier(gameState);
  spawnAchievementEffects(unlocked);
  return true;
}

function spawnClaimEffects(result, clickPoint = null) {
  if (!canvas) return;

  const rawAnchor = clampPointToCanvas(clickPoint);
  const expText = formatSignedNumber(result.expGain);
  const coinText = formatSignedNumber(result.coinGain);
  const shardText = formatSignedNumber(result.shardGain);
  const coreText = formatSignedNumber(result.coreGain);
  const totalBonusPercent = (gameState.progressBar.rewardMultiplier - 1) * 100;
  const hasBonusText = totalBonusPercent > 0;
  const bonusText = hasBonusText
    ? `Bonus ${formatSignedPercent(totalBonusPercent)}`
    : '';

  const rewardGroupEntries = [
    { text: expText, font: REWARD_POPUP_FONT, offsetX: -55, offsetY: -20 },
    { text: coinText, font: REWARD_POPUP_FONT, offsetX: 55, offsetY: -20 }
  ];

  if (result.shardGain > 0) {
    rewardGroupEntries.push({ text: shardText, font: REWARD_POPUP_FONT, offsetX: -55, offsetY: 12 });
  }

  if (result.coreGain > 0) {
    rewardGroupEntries.push({ text: coreText, font: REWARD_POPUP_FONT, offsetX: 55, offsetY: 12 });
  }

  if (hasBonusText) {
    rewardGroupEntries.push({ text: bonusText, font: BONUS_TEXT_FONT, offsetX: 0, offsetY: -80 });
  }

  const anchor = clampRewardAnchorToCanvas(rawAnchor, rewardGroupEntries);
  const expPopupPoint = { x: anchor.x - 55, y: anchor.y - 20 };
  const coinPopupPoint = { x: anchor.x + 55, y: anchor.y - 20 };
  const shardPopupPoint = { x: anchor.x - 55, y: anchor.y + 12 };
  const corePopupPoint = { x: anchor.x + 55, y: anchor.y + 12 };
  const bonusPopupPoint = { x: anchor.x, y: anchor.y - 80 };

  spawnLevelUpEffects(result.levelUps);
  spawnRewardPopup(
    floatingTexts,
    canvas,
    expText,
    expPopupPoint.x,
    expPopupPoint.y,
    COLORS.rewards.expGain,
    'exp'
  );
  spawnRewardPopup(
    floatingTexts,
    canvas,
    coinText,
    coinPopupPoint.x,
    coinPopupPoint.y,
    COLORS.rewards.coins,
    'coins'
  );

  if (result.shardGain > 0) {
    spawnRewardPopup(
      floatingTexts,
      canvas,
      shardText,
      shardPopupPoint.x,
      shardPopupPoint.y,
      COLORS.rewards.shards,
      'shards'
    );
  }

  if (result.coreGain > 0) {
    spawnRewardPopup(
      floatingTexts,
      canvas,
      coreText,
      corePopupPoint.x,
      corePopupPoint.y,
      COLORS.rewards.cores,
      'cores'
    );
  }

  if (hasBonusText) {
    spawnFloatingText(
      floatingTexts,
      bonusText,
      bonusPopupPoint.x,
      bonusPopupPoint.y,
      COLORS.rewards.totalBonus,
      {
        font: BONUS_TEXT_FONT
      }
    );
  }
}

function spawnQuestClaimEffects(summary) {
  if (!canvas || !summary.claimedAny) return;

  const allClaims = [...summary.mainClaims, ...summary.dailyClaims];
  const maxInlineClaims = 4;

  for (let i = 0; i < Math.min(allClaims.length, maxInlineClaims); i += 1) {
    const claim = allClaims[i];
    spawnFloatingText(
      floatingTexts,
      `${claim.questName} ${['-', 'C', 'B', 'A', 'S'][claim.rank]}: ${formatSignedNumberWithUnit(claim.reward, 'QT')}`,
      canvas.width / 2,
      canvas.height / 2 - 30 + (i * 22),
      COLORS.rewards.questSummary,
      {
        font: UI_MESSAGE_SMALL_FONT
      }
    );
  }

  if (allClaims.length > maxInlineClaims) {
    spawnFloatingText(
      floatingTexts,
      `...and ${formatInteger(allClaims.length - maxInlineClaims)} more quest rewards`,
      canvas.width / 2,
      canvas.height / 2 + 60,
      COLORS.rewards.questSummaryOverflow,
      {
        font: SMALL_TEXT_FONT
      }
    );
  }

  spawnFloatingText(
    floatingTexts,
    formatSignedNumberWithUnit(summary.totalQuestTokens, 'QT'),
    canvas.width / 2,
    canvas.height / 2 - 70,
    COLORS.rewards.questTokenGain,
    {
      font: UI_MESSAGE_FONT
    }
  );

  if (summary.totalEventTokens > 0) {
    spawnFloatingText(
      floatingTexts,
      formatSignedNumberWithUnit(summary.totalEventTokens, 'ET'),
      canvas.width / 2,
      canvas.height / 2 - 48,
      COLORS.rewards.eventTokenGain,
      {
        font: BONUS_TEXT_FONT
      }
    );
  }

  const totalBonusPercent = (gameState.progressBar.rewardMultiplier - 1) * 100;
  if (totalBonusPercent > 0) {
    spawnFloatingText(
      floatingTexts,
      `Total Bonus ${formatSignedPercent(totalBonusPercent)}`,
      canvas.width / 2,
      canvas.height / 2 - 92,
      COLORS.rewards.totalBonus,
      {
        font: BONUS_TEXT_FONT
      }
    );
  }
}

function update(deltaTime) {
  const questRefresh = refreshQuestState(gameState);
  const bonusRefresh = refreshDailyBonusState(gameState.dailyBonus);
  if (questRefresh.didDailyReset || bonusRefresh.didGrantToken) {
    saveCurrentFile();
  }

  updateProgressBar(gameState, deltaTime);

  updateSisuDecay(gameState, deltaTime);

  const levelUps = applyLevelUps(gameState);
  if (levelUps.length > 0) {
    spawnLevelUpEffects(levelUps);
  }

  if (evaluateAndRenderAchievements()) {
    saveCurrentFile();
  }

  updateFloatingTexts(floatingTexts, deltaTime);
  updateParticles(clickParticles, deltaTime);
  updateWebGLEffects(deltaTime);

  // Auto-claim when idle mode is enabled and bar is full
  checkAutoClaim();
}

function checkAutoClaim() {
  // Only auto-claim if:
  // 1. Idle Mode is purchased
  // 2. Idle Mode toggle is ON
  // 3. Progress bar is full (canClaim = true)

  if (!gameState.features?.idleModePurchased) return;
  if (!gameState.idleMode) return;
  if (!gameState.canClaim) return;

  // Auto-claim rewards - trigger handleClaimReward without a click point
  handleClaimReward();
}

function handleClaimReward(clickPoint = null) {
  const result = claimReward(gameState);
  if (!result) return;

  triggerProgressBarCollectionEffect(canvas);
  spawnClaimEffects(result, clickPoint);
  evaluateAndRenderAchievements();
  saveCurrentFile();
}

function handleClaimAllQuestRewards() {
  const summary = claimAllQuestRewards(gameState);
  if (!summary.claimedAny) {
    return false;
  }

  updateRewardMultiplier(gameState);
  spawnQuestClaimEffects(summary);
  evaluateAndRenderAchievements();
  saveCurrentFile();
  return true;
}

function handleClaimQuestReward(questTab, questId) {
  const summary = claimQuestReward(gameState, questTab, questId);
  if (!summary.claimedAny) {
    return false;
  }

  updateRewardMultiplier(gameState);
  spawnQuestClaimEffects(summary);
  evaluateAndRenderAchievements();
  saveCurrentFile();
  return true;
}

function openDailyBonusModal() {
  if (!gameState.features?.bonusTimePurchased) {
    openLockedElementUnlock(LOCKED_ELEMENT_IDS.bonusTime);
    return;
  }

  closeSisuModal();
  questOverlay.open = false;
  overlayLayout = null;
  clearOverlayHighlight();

  const refresh = refreshDailyBonusState(gameState.dailyBonus);
  if (refresh.didGrantToken) {
    saveCurrentFile();
  }

  dailyBonusModal.open = true;
  dailyBonusModal.result = null;
  dailyBonusModal.openedAt = 0;
  dailyBonusModal.message = '';
  dailyBonusModal.messageAt = 0;
  syncDailyBonusModalCardPickState(gameState.dailyBonus?.cardPickSession || null);
  markScreenViewAndCheck('daily');
}

function closeDailyBonusModal() {
  dailyBonusModal.open = false;
  dailyBonusModal.result = null;
  dailyBonusModal.openedAt = 0;
  dailyBonusModal.message = '';
  dailyBonusModal.messageAt = 0;
  dailyBonusModal.activeGameRender = null;
  syncDailyBonusModalCardPickState(null);
  dailyBonusModalLayout = null;
}

function syncDailyBonusModalCardPickState(session, revealAt = null) {
  dailyBonusModal.cardPickSession = session || null;
  dailyBonusModal.cardPickSelectedIndexes = Array.isArray(session?.selectedCardIndexes)
    ? [...session.selectedCardIndexes]
    : [];
  dailyBonusModal.cardPickCurrentPhaseIndex = Math.max(0, Number(session?.currentPhaseIndex) || 0);
  if (revealAt !== null) {
    dailyBonusModal.cardPickRevealAt = revealAt;
  } else if (!session) {
    dailyBonusModal.cardPickRevealAt = 0;
  }
}

function showDailyBonusMessage(message) {
  dailyBonusModal.message = message || 'No bonus token';
  dailyBonusModal.messageAt = performance.now();

  if (canvas) {
    spawnFloatingText(
      floatingTexts,
      dailyBonusModal.message,
      canvas.width / 2,
      canvas.height / 2,
      COLORS.rewards.shards,
      { font: UI_MESSAGE_SMALL_FONT }
    );
  }
}

function handleDailyBonusPlay() {
  if (dailyBonusModal.result || dailyBonusModal.activeGameRender) {
    return;
  }

  const result = playDailyBonus(gameState);
  if (result.success) {
    if (result.pendingInteraction) {
      if (result.gameId === 'coin_rain') {
        dailyBonusModal.activeGameRender = 'coin_rain';
        startCoinRainRender(ctx, dailyBonusModalLayout.stageRect, result.parameters);
      }
      return;
    }

    dailyBonusModal.result = result;
    dailyBonusModal.openedAt = performance.now();
    dailyBonusModal.message = '';
    dailyBonusModal.messageAt = 0;
    syncDailyBonusModalCardPickState(result.session || null, dailyBonusModal.openedAt);
    saveCurrentFile();
    if (evaluateAndRenderAchievements()) {
      saveCurrentFile();
    }
    return;
  }

  showDailyBonusMessage(result.reason || 'No bonus token');
}

function handleDailyBonusCardPickCard(cardIndex) {
  if (!gameState.dailyBonus?.cardPickSession) {
    if (dailyBonusModal.result) {
      return;
    }

    const started = playDailyBonus(gameState);
    if (!started.success) {
      showDailyBonusMessage(started.reason || 'No bonus token');
      return;
    }

    if (started.gameId !== CARD_PICK_GAME.id || !started.session) {
      showDailyBonusMessage('Card Pick is not active');
      return;
    }

    dailyBonusModal.result = started;
    dailyBonusModal.openedAt = performance.now();
    dailyBonusModal.message = '';
    dailyBonusModal.messageAt = 0;
    syncDailyBonusModalCardPickState(started.session, dailyBonusModal.openedAt);
  }

  const picked = pickCardPickDailyBonusCard(gameState, cardIndex);
  if (!picked.success) {
    showDailyBonusMessage(picked.reason || 'Choose another card');
    return;
  }

  const revealAt = performance.now();
  dailyBonusModal.result = picked.session;
  dailyBonusModal.openedAt = revealAt;
  dailyBonusModal.message = '';
  dailyBonusModal.messageAt = 0;
  syncDailyBonusModalCardPickState(picked.session, revealAt);
  saveCurrentFile();

  if (picked.session.status !== CARD_PICK_SESSION_STATUS.SELECTED_REVEALED) {
    return;
  }

  const advanced = advanceCardPickDailyBonusPhase(gameState);
  if (!advanced.success) {
    showDailyBonusMessage(advanced.reason || 'Could not resolve Card Pick');
    return;
  }

  if (advanced.startsBonus) {
    const bonusAt = performance.now();
    dailyBonusModal.result = advanced.session;
    dailyBonusModal.openedAt = bonusAt;
    syncDailyBonusModalCardPickState(advanced.session, bonusAt);
    saveCurrentFile();
    return;
  }

  const completed = completeCardPickDailyBonusSession(gameState);
  if (!completed.success) {
    showDailyBonusMessage(completed.reason || 'Could not finish Card Pick');
    return;
  }

  dailyBonusModal.result = completed;
  dailyBonusModal.openedAt = performance.now();
  syncDailyBonusModalCardPickState(null);
  saveCurrentFile();

  if (evaluateAndRenderAchievements()) {
    saveCurrentFile();
  }
}

function handleShopPurchase(shopId, itemId) {
  const result = purchaseShopItem(shopId, itemId);
  if (result.success) {
    if (
      questOverlay.highlightedShopItem?.shopId === shopId
      && questOverlay.highlightedShopItem?.itemId === itemId
    ) {
      questOverlay.highlightedShopItem = null;
    }
    saveCurrentFile();
    // Show simple feedback
    if (canvas) {
      spawnFloatingText(
        floatingTexts,
        `Purchased ${itemId}!`,
        canvas.width / 2,
        canvas.height / 2,
        COLORS.rewards.achievement,
        { font: UI_MESSAGE_FONT }
      );
    }
  } else {
    // Show why purchase failed
    if (canvas) {
      spawnFloatingText(
        floatingTexts,
        result.reason || 'Cannot purchase',
        canvas.width / 2,
        canvas.height / 2,
        COLORS.rewards.shards,
        { font: UI_MESSAGE_SMALL_FONT }
      );
    }
  }
}

function purchaseShopItem(shopId, itemId) {
  switch (shopId) {
    case FEATURE_SHOP_ID:
      return purchaseItem(gameState, itemId);
    default:
      return { success: false, reason: 'Unknown shop' };
  }
}

function markScreenViewAndCheck(screenKey) {
  recordScreenView(gameState, screenKey);
  if (evaluateAndRenderAchievements()) {
    saveCurrentFile();
  }
}

function openOverlayPanel(panel) {
  const overlayPanels = new Set(['quests', 'achievements', 'stats', 'save', 'shop']);
  const normalizedPanel = overlayPanels.has(panel) ? panel : 'quests';
  const wasOpen = questOverlay.open;
  const previousPanel = questOverlay.panel;
  closeSisuModal();
  closeDailyBonusModal();
  questOverlay.open = true;
  questOverlay.panel = normalizedPanel;

  if (!wasOpen || previousPanel !== normalizedPanel) {
    switch (normalizedPanel) {
      case 'quests':
        markScreenViewAndCheck('quests');
        break;
      case 'achievements':
        markScreenViewAndCheck('achievements');
        break;
      case 'stats':
        markScreenViewAndCheck('stats');
        break;
      case 'shop':
        markScreenViewAndCheck('shop');
        break;
      default:
        break;
    }
  }
}

function clearOverlayHighlight() {
  questOverlay.highlightedShopItem = null;
}

function openLockedElementUnlock(lockedElementId) {
  const destination = getLockedElementUnlockDestination(gameState, lockedElementId);
  if (!destination) {
    return false;
  }

  switch (destination.type) {
    case 'shop_item':
      openOverlayPanel(destination.panel);
      questOverlay.highlightedShopItem = createShopItemHighlight(destination.shopId, destination.itemId);
      return true;
    default:
      return false;
  }
}

function buildSavePanelState() {
  const globalOptions = loadGlobalOptions();
  const slots = [];

  for (let i = 0; i < MAX_SAVEFILES; i += 1) {
    const data = loadSavefileData(i);
    slots.push({
      fileIndex: i,
      isCurrent: i === gameState.fileIndex,
      hasData: Boolean(data),
      level: Number(data?.level) || 1,
      rewardsClaimed: Number(data?.progressBar?.rewardsClaimed) || 0,
      savedAt: Number(data?.savedAt) || 0
    });
  }

  return {
    slots
  };
}

function switchToSavefile(fileIndex) {
  const targetFileIndex = Math.floor(Number(fileIndex));
  if (!Number.isInteger(targetFileIndex) || targetFileIndex < 0 || targetFileIndex >= MAX_SAVEFILES) {
    return;
  }

  if (targetFileIndex === gameState.fileIndex) {
    return;
  }

  saveCurrentFile();

  const previousLastInputTime = gameState.lastInputTime;
  const nextState = createGameState();
  Object.assign(gameState, nextState);
  gameState.lastInputTime = previousLastInputTime;
  gameState.fileIndex = targetFileIndex;

  const data = loadSavefileData(targetFileIndex);
  if (data) {
    loadGame(gameState, targetFileIndex);
  }

  gameState.fileIndex = targetFileIndex;
  refreshQuestState(gameState);
  updateRequiredExp(gameState);
  ensureFirstPlayedAt(gameState);

  const globalOptions = loadGlobalOptions();
  globalOptions.lastSavefile = targetFileIndex;
  saveGlobalOptions(globalOptions);

  floatingTexts.length = 0;
  clickParticles.length = 0;
  evaluateAndRenderAchievements();
  saveCurrentFile();
}

function openResetConfirmModal(fileIndex = null) {
  questOverlay.confirmModal = {
    open: true,
    title: 'Reset Save File',
    body: 'Are you sure you want to reset this save file?\nAll progress will be lost.',
    showCancel: true,
    onOk: () => {
      const targetIndex = fileIndex !== null ? fileIndex : gameState.fileIndex;
      deleteSavefile(targetIndex);

      if (targetIndex === gameState.fileIndex) {
        const previousLastInputTime = gameState.lastInputTime;
        const nextState = createGameState();
        Object.assign(gameState, nextState);
        gameState.lastInputTime = previousLastInputTime;
        gameState.fileIndex = gameState.fileIndex;
        ensureFirstPlayedAt(gameState);
        updateRequiredExp(gameState);
      }

      questOverlay.confirmModal = null;
      saveCurrentFile();

      if (canvas) {
        spawnFloatingText(
          floatingTexts,
          'Save file reset!',
          canvas.width / 2,
          canvas.height / 2,
          COLORS.rewards.saveNotice,
          { font: UI_MESSAGE_FONT }
        );
      }
    },
    onCancel: () => {
      questOverlay.confirmModal = null;
    }
  };
}

function toggleMenuOverlay() {
  if (dailyBonusModal.open) {
    closeDailyBonusModal();
    return;
  }

  if (questOverlay.sisuModal?.open) {
    closeSisuModal();
    return;
  }

  if (questOverlay.open) {
    questOverlay.open = false;
    overlayLayout = null;
    clearOverlayHighlight();
    return;
  }

  openOverlayPanel(questOverlay.panel);
}

function openSisuModal() {
  if (!gameState.features?.sisuGeneratorPurchased) {
    return;
  }

  closeDailyBonusModal();
  questOverlay.open = false;
  overlayLayout = null;
  clearOverlayHighlight();
  questOverlay.sisuModal = { open: true };
}

function closeSisuModal() {
  questOverlay.sisuModal = null;
  sisuModalLayout = null;
}

function updateLastInputTime() {
  gameState.lastInputTime = performance.now();
}

function claimRewardOnAnyInput(clickPoint = null) {
  if (!gameState.canClaim) {
    return;
  }

  handleClaimReward(clickPoint);
}

function getCanvasPointFromMouseEvent(event) {
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
  const y = ((event.clientY - rect.top) * canvas.height) / rect.height;

  if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
    return null;
  }

  return { x, y };
}

function handleDebugMenuAction(action) {
  switch (action) {
    case 'debug_add_daily_bonus_token':
      if (addDebugDailyBonusToken(gameState)) {
        saveCurrentFile();
        spawnFloatingText(
          floatingTexts,
          '+1 Daily Token',
          150,
          canvas.height - 72,
          COLORS.rewards.eventTokenGain,
          { font: UI_MESSAGE_SMALL_FONT }
        );
      }
      break;
    case 'debug_cycle_bonus_slot': {
      const rotation = cycleDebugBonusSlot(gameState);
      if (rotation) {
        saveCurrentFile();
        spawnFloatingText(
          floatingTexts,
          `Bonus Slot ${formatInteger(rotation.activeSlot)}`,
          150,
          canvas.height - 72,
          COLORS.rewards.totalBonus,
          { font: UI_MESSAGE_SMALL_FONT }
        );
      }
      break;
    }
    default:
      break;
  }
}

function renderHoverTooltip() {
  if (
    !ctx
    || !canvas
    || !lastMousePoint
    || questOverlay.open
    || questOverlay.sisuModal?.open
    || dailyBonusModal.open
  ) {
    return;
  }

  if (areaDropdown.open && areaDropdownLayout) {
    for (const itemRect of areaDropdownLayout.itemRects) {
      if (itemRect.isLocked && pointInRect(itemRect, lastMousePoint.x, lastMousePoint.y)) {
        drawTooltip(
          ctx,
          canvas,
          lastMousePoint,
          `Unlocked at level ${itemRect.unlockLevel}`
        );
        return;
      }
    }
  }

  const buttonRects = getBottomHudButtonRects(canvas, gameState);
  const bonusTimeRect = buttonRects?.bonusTimeRect;
  if (!bonusTimeRect || bonusTimeRect.eligible || !pointInRect(bonusTimeRect, lastMousePoint.x, lastMousePoint.y)) {
    return;
  }

  drawTooltip(
    ctx,
    canvas,
    lastMousePoint,
    `Next daily token in ${formatRemainingTime(getDailyBonusTokenRemainingMs())}`
  );
}

function getDailyBonusTokenRemainingMs(now = Date.now()) {
  const rotation = getDailyBonusRotation(gameState.dailyBonus, now);
  return Math.max(0, rotation.nextChangeAt - now);
}

function formatRemainingTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(Number(milliseconds) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${formatInteger(hours)}h ${formatInteger(minutes)}m ${formatInteger(seconds)}s`;
  }

  if (minutes > 0) {
    return `${formatInteger(minutes)}m ${formatInteger(seconds)}s`;
  }

  return `${formatInteger(seconds)}s`;
}

function handleOverlayClick(event) {
  if (!questOverlay.open) {
    return false;
  }

  const point = getCanvasPointFromMouseEvent(event);
  if (!point) {
    return true;
  }

  const hit = resolveOverlayAction(overlayLayout, point.x, point.y, gameState);

  switch (hit.action) {
    case 'close':
      questOverlay.open = false;
      overlayLayout = null;
      clearOverlayHighlight();
      break;
    case 'panel_quests':
      openOverlayPanel('quests');
      break;
    case 'panel_achievements':
      openOverlayPanel('achievements');
      break;
    case 'panel_stats':
      openOverlayPanel('stats');
      break;
    case 'panel_save':
      openOverlayPanel('save');
      break;
    case 'panel_shop':
      openOverlayPanel('shop');
      break;
    case 'tab_main':
      questOverlay.questTab = 'main';
      break;
    case 'tab_daily':
      questOverlay.questTab = 'daily';
      break;
    case 'claim_all':
      handleClaimAllQuestRewards();
      break;
    case 'quest_claim':
      handleClaimQuestReward(hit.questTab, hit.questId);
      break;
    case 'save_select_file':
      switchToSavefile(hit.fileIndex);
      break;
    case 'save_reset':
      openResetConfirmModal(hit.fileIndex);
      break;
    case 'shop_purchase':
      handleShopPurchase(hit.shopId || FEATURE_SHOP_ID, hit.itemId);
      break;
    case 'sisu_upgrade':
      handleSisuUpgrade();
      break;
    case 'ok':
      // Handle confirmation modal OK
      if (questOverlay.confirmModal?.onOk) {
        questOverlay.confirmModal.onOk();
      }
      break;
    case 'cancel':
    case 'modal_cancel':
      // Handle confirmation modal Cancel
      if (questOverlay.confirmModal?.onCancel) {
        questOverlay.confirmModal.onCancel();
      } else {
        questOverlay.confirmModal = null;
      }
      break;
    default:
      if (!hit.insideOverlay) {
        questOverlay.open = false;
        overlayLayout = null;
        clearOverlayHighlight();
      }
      break;
  }

  return true;
}

function handleDailyBonusModalClick(event) {
  if (!dailyBonusModal.open) {
    return false;
  }

  const point = getCanvasPointFromMouseEvent(event);
  if (!point) {
    return true;
  }

  const hit = resolveDailyBonusModalAction(dailyBonusModalLayout, point.x, point.y);

  switch (hit.action) {
    case 'daily_bonus_close':
      closeDailyBonusModal();
      break;
    case 'daily_bonus_play':
      handleDailyBonusPlay();
      break;
    case 'card_pick_card':
      handleDailyBonusCardPickCard(hit.cardIndex);
      break;
    default:
      break;
  }

  return true;
}

function handleSisuModalClick(event) {
  if (!questOverlay.sisuModal?.open) {
    return false;
  }

  const point = getCanvasPointFromMouseEvent(event);
  if (!point) {
    return true;
  }

  const hit = resolveSisuGeneratorModalAction(sisuModalLayout, point.x, point.y);

  switch (hit.action) {
    case 'sisu_modal_close':
      closeSisuModal();
      break;
    case 'sisu_refill':
      handleSisuRefill(hit.tier, point);
      break;
    case 'sisu_upgrade':
      handleSisuUpgrade();
      break;
    default:
      break;
  }

  return true;
}

function saveCurrentFile() {
  if (gameState.fileIndex !== undefined && gameState.fileIndex >= 0) {
    saveToFile(gameState.fileIndex, gameState);
  }
}

function handleClick(event) {
  updateLastInputTime();

  const point = getCanvasPointFromMouseEvent(event);
  lastMousePoint = point;
  if (point) {
    if (!spawnGpuClickBurst(point.x, point.y)) {
      spawnClickParticleBurst(clickParticles, point.x, point.y);
    }
  }

  claimRewardOnAnyInput(point);

  if (dailyBonusModal.open) {
    handleDailyBonusModalClick(event);
    return;
  }

  if (questOverlay.sisuModal?.open) {
    handleSisuModalClick(event);
    return;
  }

  if (questOverlay.open) {
    handleOverlayClick(event);
    return;
  }

  if (!point) {
    return;
  }

  const buttonRects = getBottomHudButtonRects(canvas, gameState);
  let clickedMainButton = false;
  if (buttonRects?.areaSelectRect && pointInRect(buttonRects.areaSelectRect, point.x, point.y)) {
    clickedMainButton = true;
  }

  if (areaDropdown.open) {
    let clickedInsideMenu = false;
    if (areaDropdownLayout) {
      for (const itemRect of areaDropdownLayout.itemRects) {
        if (pointInRect(itemRect, point.x, point.y)) {
          if (!itemRect.isLocked) {
            gameState.area = itemRect.key;
            saveCurrentFile();
            areaDropdown.open = false;
          }
          clickedInsideMenu = true;
          break;
        }
      }
      if (pointInRect(areaDropdownLayout.menuRect, point.x, point.y)) {
          clickedInsideMenu = true;
      }
    }

    // With hover-to-open logic, we don't force close the menu on click anymore if we stay hovered,
    // but if an item was picked we probably want it to stay open or let hover logic handle it.
    // So we don't explicitly set areaDropdown.open = false; here anymore.

    // If we clicked inside the dropdown menu itself, we consume the click
    if (clickedInsideMenu) {
      return;
    }
    // If we clicked the main toggle button while open, we consume the click
    if (clickedMainButton) {
      return;
    }
  }

  const debugHit = resolveDebugMenuAction(debugMenuLayout, point.x, point.y);
  if (debugHit.action) {
    handleDebugMenuAction(debugHit.action);
    return;
  }

  if (debugHit.insideDebugMenu) {
    return;
  }

  const idleToggleRect = getIdleModeToggleRect(canvas);
  if (idleToggleRect && pointInRect(idleToggleRect, point.x, point.y)) {
    if (gameState.features?.idleModePurchased) {
      gameState.idleMode = !gameState.idleMode;
      saveCurrentFile();
      return;
    }

    if (openLockedElementUnlock(LOCKED_ELEMENT_IDS.idleMode)) {
      return;
    }
  }

  if (
    sisuControlLayout?.lockedElementId
    && pointInRect(sisuControlLayout.controlRect, point.x, point.y)
  ) {
    if (openLockedElementUnlock(sisuControlLayout.lockedElementId)) {
      return;
    }
  }

  if (sisuControlLayout?.iconRects) {
    for (const iconRect of sisuControlLayout.iconRects) {
      if (pointInRect(iconRect, point.x, point.y)) {
        handleSisuRefill(iconRect.tier, point);
        return;
      }
    }
  }

  if (sisuControlLayout?.controlRect && pointInRect(sisuControlLayout.controlRect, point.x, point.y)) {
    openSisuModal();
    return;
  }

  if (buttonRects?.bonusTimeRect && pointInRect(buttonRects.bonusTimeRect, point.x, point.y)) {
    if (!buttonRects.bonusTimeRect.eligible) {
      return;
    }

    if (buttonRects.bonusTimeRect.lockedElementId) {
      openLockedElementUnlock(buttonRects.bonusTimeRect.lockedElementId);
      return;
    }

    openDailyBonusModal();
    return;
  }

  if (buttonRects?.menuRect && pointInRect(buttonRects.menuRect, point.x, point.y)) {
    toggleMenuOverlay();
    return;
  }
}

function handleMouseMove(event) {
  updateLastInputTime();
  const point = getCanvasPointFromMouseEvent(event);
  lastMousePoint = point;
  claimRewardOnAnyInput(point);

  if (point) {
    const buttonRects = getBottomHudButtonRects(canvas, gameState);
    let hoveringDropdown = false;

    if (buttonRects?.areaSelectRect && pointInRect(buttonRects.areaSelectRect, point.x, point.y)) {
      hoveringDropdown = true;
    }

    if (areaDropdown.open && areaDropdownLayout && pointInRect(areaDropdownLayout.menuRect, point.x, point.y)) {
      hoveringDropdown = true;
    }

    if (hoveringDropdown) {
      areaDropdown.open = true;
    } else {
      areaDropdown.open = false;
    }
  } else {
    areaDropdown.open = false;
  }
}

function handleCanvasMouseLeave() {
  lastMousePoint = null;
}

function handleKeydown(event) {
  updateLastInputTime();
  claimRewardOnAnyInput();

  if (handleDebugKeydown(event, gameState)) {
    event.preventDefault();
    return;
  }

  if (dailyBonusModal.open && event.key === 'Escape') {
    closeDailyBonusModal();
    event.preventDefault();
    return;
  }

  if (dailyBonusModal.open) {
    event.preventDefault();
    return;
  }

  if (questOverlay.sisuModal?.open && event.key === 'Escape') {
    closeSisuModal();
    event.preventDefault();
    return;
  }

  if (event.key === 'Escape') {
    toggleMenuOverlay();
    event.preventDefault();
    return;
  }

  if (event.key === 'q' || event.key === 'Q') {
    openOverlayPanel('quests');
    event.preventDefault();
    return;
  }

  if (event.key === 'a' || event.key === 'A') {
    openOverlayPanel('achievements');
    event.preventDefault();
    return;
  }

  if (event.key === 'e' || event.key === 'E') {
    openOverlayPanel('stats');
    event.preventDefault();
    return;
  }

  if (event.key === 's' || event.key === 'S') {
    openOverlayPanel('shop');
    event.preventDefault();
    return;
  }

  if (questOverlay.open && questOverlay.panel === 'quests' && event.key === 'Tab') {
    questOverlay.questTab = questOverlay.questTab === 'main' ? 'daily' : 'main';
    event.preventDefault();
    return;
  }

  if (questOverlay.open) {
    return;
  }
}

function setupInputHandlers() {
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKeydown);
  canvas?.addEventListener('mouseleave', handleCanvasMouseLeave);
}

function gameLoop(timestamp) {
  const deltaTime = timestamp - lastTick;
  lastTick = timestamp;

  update(deltaTime);
  renderGame(ctx, canvas, gameState, floatingTexts, clickParticles);
  const buttonRects = getBottomHudButtonRects(canvas, gameState);

  if (areaDropdown.open && buttonRects && buttonRects.areaSelectRect) {
    areaDropdownLayout = renderAreaDropdown(ctx, gameState, buttonRects.areaSelectRect);
  } else {
    areaDropdownLayout = null;
  }

  // Render Sisu UI
  sisuControlLayout = renderSisuUI(ctx, canvas, gameState);

  // Render idle mode toggle below progress bar
  renderIdleModeToggle(ctx, canvas, gameState);

  debugMenuLayout = renderDebugMenu(ctx, canvas, gameState, lastMousePoint);

  if (questOverlay.open) {
    const savePanelState = questOverlay.panel === 'save' ? buildSavePanelState() : null;
    overlayLayout = renderOverlay(ctx, canvas, gameState, questOverlay, savePanelState);
  } else {
    overlayLayout = null;
  }

  if (questOverlay.sisuModal?.open) {
    sisuModalLayout = renderSisuGeneratorModal(ctx, canvas, gameState);
  } else {
    sisuModalLayout = null;
  }

  if (dailyBonusModal.open) {
    dailyBonusModalLayout = renderDailyBonusModal(ctx, canvas, gameState, dailyBonusModal);

    if (dailyBonusModal.activeGameRender === 'coin_rain' && dailyBonusModalLayout?.stageRect) {
      const caughtItems = renderCoinRain(ctx, dailyBonusModalLayout.stageRect);
      if (caughtItems) {
        const resultStats = evaluateCoinRainResults(caughtItems);
        dailyBonusModal.activeGameRender = null;

        const tokenType = gameState.dailyBonus.dailyTokens > 0 ? 'daily' : 'special';

        const finalResult = {
          success: true,
          gameId: resultStats.gameId,
          slot: resultStats.slot,
          rewardId: resultStats.rewardId,
          rarity: resultStats.rarity,
          tier: resultStats.tier,
          playedAt: Date.now(),
          tokenType
        };

        gameState.dailyBonus.lastResult = finalResult;
        dailyBonusModal.result = finalResult;
        dailyBonusModal.openedAt = performance.now();

        saveCurrentFile();
        if (evaluateAndRenderAchievements()) {
          saveCurrentFile();
        }
      }
    }
  } else {
    dailyBonusModalLayout = null;
  }

  renderHoverTooltip();

  renderWebGLEffects({
    visible: !questOverlay.open && !questOverlay.sisuModal?.open && !dailyBonusModal.open
  });

  requestAnimationFrame(gameLoop);
}

function findFirstPopulatedSavefile() {
  for (let i = 0; i < MAX_SAVEFILES; i += 1) {
    if (checkHasSaveData(i)) {
      return i;
    }
  }
  return -1;
}

function determineInitialSavefile() {
  const autoFile = getAutoSelectFile();
  if (autoFile >= 0) {
    return autoFile;
  }

  if (!checkAnySaveDataExists()) {
    return 0;
  }

  const globalOptions = loadGlobalOptions();
  if (checkHasSaveData(globalOptions.lastSavefile)) {
    return globalOptions.lastSavefile;
  }

  const firstPopulatedFile = findFirstPopulatedSavefile();
  return firstPopulatedFile >= 0 ? firstPopulatedFile : 0;
}

function initGame() {
  applyCssThemeVariables();

  const initialFileIndex = determineInitialSavefile();
  gameState.fileIndex = initialFileIndex;
  loadGame(gameState, initialFileIndex);
  gameState.fileIndex = initialFileIndex;

  const globalOptions = loadGlobalOptions();
  globalOptions.lastSavefile = initialFileIndex;
  saveGlobalOptions(globalOptions);

  updateRequiredExp(gameState);
  ensureFirstPlayedAt(gameState);

  createCanvasIfNeeded();
  setupInputHandlers();

  const questRefresh = refreshQuestState(gameState);
  const bonusRefresh = refreshDailyBonusState(gameState.dailyBonus);
  const unlocked = evaluateAchievements(gameState);
  if (unlocked.length > 0) {
    spawnAchievementEffects(unlocked);
  }

  updateRewardMultiplier(gameState);

  if (questRefresh.didDailyReset || bonusRefresh.didGrantToken || unlocked.length > 0) {
    saveToFile(gameState.fileIndex, gameState);
  }

  saveToFile(gameState.fileIndex, gameState);

  lastTick = performance.now();
  requestAnimationFrame(gameLoop);
}

function saveGameFromConsole() {
  saveCurrentFile();
}

function loadGameFromConsole() {
  loadGame(gameState);
  refreshQuestState(gameState);
  refreshDailyBonusState(gameState.dailyBonus);
  const unlocked = evaluateAchievements(gameState);
  if (unlocked.length > 0) {
    spawnAchievementEffects(unlocked);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}

window.GameState = gameState;
window.game = { gameState, openDailyBonusModal };
window.claimReward = handleClaimReward;
window.saveGame = saveGameFromConsole;
window.loadGame = loadGameFromConsole;
window.claimAllQuestRewards = handleClaimAllQuestRewards;

function getFloatingTextAnchor(point, text, font) {
  const rawAnchor = clampPointToCanvas(point);
  return clampRewardAnchorToCanvas(rawAnchor, [
    { text, font, offsetX: 0, offsetY: 0 }
  ]);
}

function handleSisuRefill(tier = 'blue', clickPoint = null) {
  const result = refillSisu(gameState, tier);
  if (result.success) {
    saveCurrentFile();
  } else if (canvas) {
    const text = result.reason || 'Cannot refill sisu';
    const anchor = getFloatingTextAnchor(clickPoint, text, UI_MESSAGE_SMALL_FONT);
    spawnFloatingText(
      floatingTexts,
      text,
      anchor.x,
      anchor.y,
      COLORS.rewards.shards,
      { font: UI_MESSAGE_SMALL_FONT }
    );
  }
}

function handleSisuUpgrade() {
  const result = purchaseMaxSisuUpgrade(gameState);
  if (result.success) {
    saveCurrentFile();
    const newMax = gameState.sisu.maxBasic;
    if (canvas) {
      spawnFloatingText(
        floatingTexts,
        `Max Sisu: ${formatSisuMultiplier(newMax)}!`,
        canvas.width / 2,
        canvas.height / 2,
        COLORS.rewards.shards,
        { font: UI_MESSAGE_FONT }
      );
    }
  } else {
    if (canvas) {
      spawnFloatingText(
        floatingTexts,
        result.reason || 'Cannot upgrade',
        canvas.width / 2,
        canvas.height / 2,
        COLORS.rewards.shards,
        { font: UI_MESSAGE_SMALL_FONT }
      );
    }
  }
}
