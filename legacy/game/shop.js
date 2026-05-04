// Feature Shop - purchases unlock special game features
import { COLORS } from './colors.js';
import { drawButton } from './ui/components.js';
import { initializeSisuGenerator } from './sisu/mechanics.js';
import { drawCurrencyAmount } from './currency-icons.js';
import { formatInteger } from './format.js';
import {
  SHOP_ITEM_NAME_FONT,
  SHOP_ITEM_DESC_FONT,
  SHOP_ITEM_COST_FONT,
  SHOP_ITEM_REQ_FONT,
} from './config.js';
import { SHOP_IDS } from './locked-elements.js';

export const FEATURE_SHOP_ID = SHOP_IDS.feature;

// Feature Shop Item Definitions
export const FEATURE_SHOP_ITEMS = {
  idleMode: {
    id: 'idleMode',
    name: 'Idle Mode',
    description: 'Allows you to claim rewards automatically, but slowly!',
    cost: 500,
    requiredLevel: 2,
    currency: 'coins',
    unlocks: ['worldMap']
  },
  sisuGenerator: {
    id: 'sisuGenerator',
    name: 'Sisu Generator',
    description: 'Refill Sisu and upgrade Max Sisu!',
    cost: 2000,
    requiredLevel: 4,
    currency: 'coins',
    unlocks: []
  },
  bonusTime: {
    id: 'bonusTime',
    name: 'BONUSTIME',
    description: 'Play daily bonus games when a daily token is ready!',
    cost: 1000,
    requiredLevel: 15,
    currency: 'shards',
    unlocks: []
  }
};

export function createShopOverlayState() {
  return {
    open: false,
    panel: 'shop'
  };
}

export function getShopItem(itemId) {
  return FEATURE_SHOP_ITEMS[itemId] || null;
}

export function canPurchaseItem(state, itemId) {
  const item = getShopItem(itemId);
  if (!item) {
    return { canPurchase: false, reason: 'Unknown item' };
  }

  // Check if already owned
  if (state.features?.[`${itemId}Purchased`]) {
    return { canPurchase: false, reason: 'Already owned' };
  }

  // Check level requirement
  if (state.level < item.requiredLevel) {
    return { canPurchase: false, reason: `Requires Level ${formatInteger(item.requiredLevel)}` };
  }

  // Check currency
  const currencyKey = item.currency || 'coins';
  const currentBalance = state[currencyKey] || 0;
  if (currentBalance < item.cost) {
    return { canPurchase: false, reason: `Not enough ${currencyKey}` };
  }

  return { canPurchase: true, reason: null };
}

export function purchaseItem(state, itemId) {
  const item = getShopItem(itemId);
  if (!item) {
    return { success: false, reason: 'Unknown item' };
  }

  const purchaseCheck = canPurchaseItem(state, itemId);
  if (!purchaseCheck.canPurchase) {
    return { success: false, reason: purchaseCheck.reason };
  }

  // Deduct cost
  const currencyKey = item.currency || 'coins';
  state[currencyKey] -= item.cost;

  // Mark as purchased
  if (!state.features) {
    state.features = {};
  }
  state.features[`${itemId}Purchased`] = true;

  // Handle item-specific activation logic
  if (itemId === 'sisuGenerator') {
    initializeSisuGenerator(state);
  }

  // Handle unlock triggers
  if (item.unlocks) {
    for (const unlock of item.unlocks) {
      state.features[`${unlock}Unlocked`] = true;
    }
  }

  return { success: true, reason: null };
}

export function renderShopPanel(ctx, overlayRect, state, options = {}) {
  const {
    shopId = FEATURE_SHOP_ID,
    highlightedItemId = null
  } = options;

  const startX = overlayRect.x + 30;
  const startY = overlayRect.y + 100;
  const itemWidth = overlayRect.width - 60;
  const itemHeight = 80;
  const itemGap = 20;

  let currentY = startY;
  const itemRects = [];

  // Render unowned items first, owned items last
  const sortedShopItems = Object.entries(FEATURE_SHOP_ITEMS).sort(([itemIdA], [itemIdB]) => {
    const ownedA = Boolean(state.features?.[`${itemIdA}Purchased`]);
    const ownedB = Boolean(state.features?.[`${itemIdB}Purchased`]);

    return Number(ownedA) - Number(ownedB);
  });

  // Render each shop item
  for (const [itemId, item] of sortedShopItems) {
    const isOwned = Boolean(state.features?.[`${itemId}Purchased`]);
    if (isOwned) {
      ctx.globalAlpha = 0.4;
    }
    const purchaseCheck = canPurchaseItem(state, itemId);
    const isHighlighted = highlightedItemId === itemId;

    const itemRect = {
      x: startX,
      y: currentY,
      width: itemWidth,
      height: itemHeight
    };
    itemRects.push({ shopId, itemId, rect: itemRect });

    // Draw item background
    ctx.fillStyle = COLORS.button.secondary.surface;
    ctx.fillRect(itemRect.x, itemRect.y, itemRect.width, itemRect.height);

    if (isHighlighted) {
      const highlightWidth = 4;
      ctx.strokeStyle = COLORS.rewards.achievement;
      ctx.lineWidth = highlightWidth;
      ctx.strokeRect(
        itemRect.x + highlightWidth / 2,
        itemRect.y + highlightWidth / 2,
        itemRect.width - highlightWidth,
        itemRect.height - highlightWidth
      );
    } else {
      ctx.strokeStyle = COLORS.button.secondary.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(itemRect.x, itemRect.y, itemRect.width, itemRect.height);
    }

    // Item name
    ctx.fillStyle = COLORS.overlay.titleText;
    ctx.font = SHOP_ITEM_NAME_FONT;
    ctx.textAlign = 'left';
    ctx.fillText(item.name, itemRect.x + 15, itemRect.y + 25);

    // Item description
    ctx.fillStyle = COLORS.overlay.bodyText;
    ctx.font = SHOP_ITEM_DESC_FONT;
    ctx.fillText(item.description, itemRect.x + 15, itemRect.y + 48);

    // Cost or status
    ctx.textAlign = 'right';
    if (isOwned) {
      ctx.fillStyle = COLORS.rewards.achievement;
      ctx.font = SHOP_ITEM_NAME_FONT;
      ctx.fillText('OWNED', itemRect.x + itemRect.width - 15, itemRect.y + 30);
    } else {
      const currencyKey = item.currency || 'coins';
      const costColor = purchaseCheck.canPurchase ? COLORS.hud[currencyKey] || COLORS.hud.textPrimary : '#888888';
      ctx.fillStyle = costColor;
      ctx.font = SHOP_ITEM_COST_FONT;
      drawCurrencyAmount(ctx, currencyKey, item.cost, itemRect.x + itemRect.width - 15, itemRect.y + 30, 24, {
        align: 'right',
        font: SHOP_ITEM_COST_FONT,
        textColor: costColor,
        iconGap: 6
      });

      // Show requirement or status
      ctx.fillStyle = '#888888';
      ctx.font = SHOP_ITEM_REQ_FONT;
      if (purchaseCheck.reason) {
        ctx.fillText(purchaseCheck.reason, itemRect.x + itemRect.width - 15, itemRect.y + 50);
      }
    }

    currentY += itemHeight + itemGap;
  }

  ctx.globalAlpha = 1;

  // Return click zones (return the item rects for click detection)
  return {
    itemRects
  };
}
