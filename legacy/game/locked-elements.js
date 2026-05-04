export const SHOP_IDS = Object.freeze({
  feature: 'feature'
});

export const LOCKED_ELEMENT_IDS = Object.freeze({
  idleMode: 'idleMode',
  sisuGenerator: 'sisuGenerator',
  bonusTime: 'bonusTime'
});

const UNLOCK_PLACES = Object.freeze({
  featureShop: {
    id: 'featureShop',
    kind: 'shop',
    shopId: SHOP_IDS.feature,
    panel: 'shop',
    isUnlocked: () => true
  }
});

const LOCKED_ELEMENT_DESTINATIONS = Object.freeze({
  [LOCKED_ELEMENT_IDS.idleMode]: {
    type: 'shop_item',
    placeId: 'featureShop',
    itemId: 'idleMode'
  },
  [LOCKED_ELEMENT_IDS.sisuGenerator]: {
    type: 'shop_item',
    placeId: 'featureShop',
    itemId: 'sisuGenerator'
  },
  [LOCKED_ELEMENT_IDS.bonusTime]: {
    type: 'shop_item',
    placeId: 'featureShop',
    itemId: 'bonusTime'
  }
});

export function getLockedElementUnlockDestination(state, lockedElementId) {
  const destination = LOCKED_ELEMENT_DESTINATIONS[lockedElementId];
  if (!destination) {
    return null;
  }

  const place = UNLOCK_PLACES[destination.placeId];
  if (!place || (typeof place.isUnlocked === 'function' && !place.isUnlocked(state))) {
    return null;
  }

  return {
    ...destination,
    place,
    panel: place.panel,
    shopId: place.shopId
  };
}

export function getShopHighlightForPanel(overlayState, shopId) {
  const highlight = overlayState?.highlightedShopItem;
  if (!highlight || highlight.shopId !== shopId) {
    return null;
  }

  return highlight.itemId || null;
}

export function createShopItemHighlight(shopId, itemId) {
  if (!shopId || !itemId) {
    return null;
  }

  return { shopId, itemId };
}
