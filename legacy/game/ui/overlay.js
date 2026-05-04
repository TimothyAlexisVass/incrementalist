import { COLORS } from '../colors.js';
import { drawButton } from './components.js';
import { renderConfirmationModal, resolveConfirmationModalAction } from './components.js';
import { renderQuestsPanel } from '../quests/render.js';
import { renderAchievementsPanel } from '../achievements/render.js';
import { renderStatsPanel } from '../stats/render.js';
import { renderSavePanel } from '../saves/render.js';
import { FEATURE_SHOP_ID, renderShopPanel } from '../shop.js';
import { OVERLAY_TITLE_FONT } from '../config.js';
import { getShopHighlightForPanel } from '../locked-elements.js';

export function renderOverlay(ctx, canvas, state, overlayState, savePanelState = null) {
  if (!overlayState.open) return null;

  const overlayRect = {
    x: 40,
    y: 40,
    width: canvas.width - 80,
    height: canvas.height - 80
  };

  const closeRect = {
    x: overlayRect.x + overlayRect.width - 90,
    y: overlayRect.y + 12,
    width: 70,
    height: 28
  };

  const tabY = overlayRect.y + 54;
  const tabHeight = 30;
  const tabGap = 8;
  const panelQuestsRect = {
    x: overlayRect.x + 20,
    y: tabY,
    width: 120,
    height: tabHeight
  };

  const panelAchievementsRect = {
    x: panelQuestsRect.x + panelQuestsRect.width + tabGap,
    y: tabY,
    width: 160,
    height: tabHeight
  };

  const panelStatsRect = {
    x: panelAchievementsRect.x + panelAchievementsRect.width + tabGap,
    y: tabY,
    width: 110,
    height: tabHeight
  };

  const panelSaveRect = {
    x: panelStatsRect.x + panelStatsRect.width + tabGap,
    y: tabY,
    width: 120,
    height: tabHeight
  };

  const questMainRect = {
    x: overlayRect.x + 24,
    y: overlayRect.y + 118,
    width: 130,
    height: 28
  };

  const questDailyRect = {
    x: overlayRect.x + 162,
    y: overlayRect.y + 118,
    width: 130,
    height: 28
  };

  const panelShopRect = {
    x: panelSaveRect.x + panelSaveRect.width + tabGap,
    y: tabY,
    width: 100,
    height: tabHeight
  };

  ctx.fillStyle = COLORS.overlay.backdrop;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLORS.overlay.panel;
  ctx.fillRect(overlayRect.x, overlayRect.y, overlayRect.width, overlayRect.height);
  ctx.strokeStyle = COLORS.overlay.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(overlayRect.x, overlayRect.y, overlayRect.width, overlayRect.height);

  ctx.fillStyle = COLORS.overlay.titleText;
  ctx.font = OVERLAY_TITLE_FONT;
  ctx.textAlign = 'left';
  const panelTitles = {
    quests: 'Quest',
    achievements: 'Achievements',
    stats: 'Stats',
    save: 'Save Files',
    shop: 'Feature Shop'
  };
  const title = panelTitles[overlayState.panel] || 'Menu';
  ctx.fillText(title, overlayRect.x + 20, overlayRect.y + 34);

  drawButton(ctx, panelQuestsRect, 'Quest [Q]', { active: overlayState.panel === 'quests' });
  drawButton(ctx, panelAchievementsRect, 'Achievements [A]', { active: overlayState.panel === 'achievements' });
  drawButton(ctx, panelStatsRect, 'Stats [E]', { active: overlayState.panel === 'stats' });
  drawButton(ctx, panelSaveRect, 'Save Files', { active: overlayState.panel === 'save' });
  drawButton(ctx, panelShopRect, 'Shop [S]', { active: overlayState.panel === 'shop' });
  drawButton(ctx, closeRect, 'Close', { active: false });

  let saveLayout = null;
  let shopLayout = null;
  let questsLayout = null;
  let confirmModalLayout = null;

  if (overlayState.panel === 'achievements') {
    renderAchievementsPanel(ctx, overlayRect, state);
  } else if (overlayState.panel === 'stats') {
    renderStatsPanel(ctx, overlayRect, state);
  } else if (overlayState.panel === 'save') {
    saveLayout = renderSavePanel(ctx, overlayRect, savePanelState);
  } else if (overlayState.panel === 'shop') {
    shopLayout = renderShopPanel(ctx, overlayRect, state, {
      shopId: FEATURE_SHOP_ID,
      highlightedItemId: getShopHighlightForPanel(overlayState, FEATURE_SHOP_ID)
    });
  } else {
    drawButton(ctx, questMainRect, 'Main', { active: overlayState.questTab === 'main' });
    drawButton(ctx, questDailyRect, 'Daily', { active: overlayState.questTab === 'daily' });
    questsLayout = renderQuestsPanel(ctx, overlayRect, state, overlayState.questTab);
  }

  // Handle confirmation modal - renders on top of other panels
  if (overlayState.confirmModal?.open) {
    confirmModalLayout = renderConfirmationModal(ctx, canvas, overlayState.confirmModal);
  }

  return {
    overlayRect,
    closeRect,
    panelQuestsRect,
    panelAchievementsRect,
    panelStatsRect,
    panelSaveRect,
    panelShopRect,
    questMainRect,
    questDailyRect,
    questClickZones: questsLayout?.questClickZones ?? [],
    saveFileRects: saveLayout?.saveFileRects ?? [],
    resetButtonRects: saveLayout?.resetButtonRects ?? [],
    shopItemRects: shopLayout?.itemRects ?? [],
    confirmModalLayout,
    panel: overlayState.panel
  };
}

export function resolveOverlayAction(layout, x, y, gameState = null) {
  if (!layout) {
    return { action: null, insideOverlay: false };
  }

  // Handle confirmation modal clicks first (if open)
  if (layout.confirmModalLayout) {
    const modalHit = resolveConfirmationModalAction(layout.confirmModalLayout, x, y);
    if (modalHit.action) {
      return { action: modalHit.action, insideOverlay: true, isModalAction: true };
    }
    // Click on backdrop also closes modal
    return { action: 'modal_cancel', insideOverlay: true, isModalAction: true };
  }

  const insideOverlay = pointInRect(layout.overlayRect, x, y);
  if (!insideOverlay) {
    return { action: null, insideOverlay: false };
  }

  if (pointInRect(layout.closeRect, x, y)) {
    return { action: 'close', insideOverlay: true };
  }

  if (pointInRect(layout.panelQuestsRect, x, y)) {
    return { action: 'panel_quests', insideOverlay: true };
  }

  if (pointInRect(layout.panelAchievementsRect, x, y)) {
    return { action: 'panel_achievements', insideOverlay: true };
  }

  if (pointInRect(layout.panelStatsRect, x, y)) {
    return { action: 'panel_stats', insideOverlay: true };
  }

  if (pointInRect(layout.panelSaveRect, x, y)) {
    return { action: 'panel_save', insideOverlay: true };
  }

  if (pointInRect(layout.panelShopRect, x, y)) {
    return { action: 'panel_shop', insideOverlay: true };
  }

  if (layout.panel === 'quests') {
    if (pointInRect(layout.questMainRect, x, y)) {
      return { action: 'tab_main', insideOverlay: true };
    }

    if (pointInRect(layout.questDailyRect, x, y)) {
      return { action: 'tab_daily', insideOverlay: true };
    }

    for (const zone of layout.questClickZones || []) {
      if (zone.isReady && pointInRect(zone.rect, x, y)) {
        return {
          action: 'quest_claim',
          questId: zone.questId,
          questTab: zone.questTab,
          insideOverlay: true
        };
      }
    }
  }

  if (layout.panel === 'save') {
    for (const resetRect of layout.resetButtonRects || []) {
      if (pointInRect(resetRect, x, y)) {
        return { action: 'save_reset', fileIndex: resetRect.fileIndex, insideOverlay: true };
      }
    }
    for (const fileRect of layout.saveFileRects || []) {
      if (pointInRect(fileRect, x, y)) {
        return { action: 'save_select_file', fileIndex: fileRect.fileIndex, insideOverlay: true };
      }
    }
  }

  if (layout.panel === 'shop') {
    for (const itemRect of layout.shopItemRects || []) {
      if (pointInRect(itemRect.rect, x, y)) {
        return {
          action: 'shop_purchase',
          shopId: itemRect.shopId,
          itemId: itemRect.itemId,
          insideOverlay: true
        };
      }
    }
  }

  return { action: null, insideOverlay: true };
}

function pointInRect(rect, x, y) {
  return x >= rect.x
    && x <= rect.x + rect.width
    && y >= rect.y
    && y <= rect.y + rect.height;
}
