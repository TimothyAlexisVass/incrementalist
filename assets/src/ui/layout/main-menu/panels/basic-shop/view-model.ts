import { ServerState } from '../../../../../net/snapshots';
import { ShopItemDefinition } from '../../../../../net/protocol';
import { BigNum, compare } from '../../../../../core/bignum';

export interface ShopItemViewModel extends ShopItemDefinition {
  canAfford: boolean;
  isHighlighted: boolean;
}

export function getShopViewModel(state: ServerState): ShopItemViewModel[] {
  const shopItems = state.snapshot?.state.shop || [];
  const highlightedId = state.uiHints.highlightedShopItemId;
  
  return shopItems.map(item => {
    const balance = state.snapshot?.state[item.currency] || { m: 0, e: 0 };
    return {
      ...item,
      canAfford: compare(balance, item.cost) >= 0,
      isHighlighted: item.id === highlightedId
    };
  }).sort((a, b) => {
    if (a.is_purchased && !b.is_purchased) return 1;
    if (!a.is_purchased && b.is_purchased) return -1;
    return 0;
  });
}
