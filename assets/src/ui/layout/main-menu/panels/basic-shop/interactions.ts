import { InteractionState } from '../../../../managers/interactions';
import { ShopItemViewModel } from './view-model';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { handleShopItemCardInteractions, ShopActions } from '../../../../components/cards/shop-item';

export { ShopActions };

export function handleShopInteractions(
  input: InteractionState,
  rect: Rect,
  items: ShopItemViewModel[],
  actions: ShopActions
) {
  if (items.length === 0) return;

  const startX = rect.x + 32;
  const startY = rect.y + 32;
  const itemWidth = rect.width - 64;
  const itemHeight = 100;
  const itemGap = 16;

  items.forEach((item, index) => {
    const itemRect = {
      x: startX,
      y: startY + (itemHeight + itemGap) * index,
      width: itemWidth,
      height: itemHeight
    };

    handleShopItemCardInteractions(input, itemRect, { item, canAfford: item.canAfford }, actions);
  });
}
