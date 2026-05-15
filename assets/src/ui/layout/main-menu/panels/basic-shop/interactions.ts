import { InteractionState } from '../../../../managers/interactions';
import { ShopItemViewModel } from './view-model';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { handleShopItemCardInteractions, ShopItemActions as ShopActions } from '../../../../components/cards/shop-item';

export type { ShopActions };

export function handleShopInteractions(
  input: InteractionState,
  rect: Rect,
  items: ShopItemViewModel[],
  actions: ShopActions,
  onInteraction: () => void
) {
  if (items.length === 0) return;

  if (input.clicked && !input.consumed) {
    onInteraction();
  }

  const startX = rect.x;
  const startY = rect.y;
  const itemWidth = rect.width;
  const itemHeight = 100;
  const itemGap = 16;

  items.forEach((item, index) => {
    const itemRect = {
      x: startX,
      y: startY + (itemHeight + itemGap) * index,
      width: itemWidth,
      height: itemHeight
    };

    if (actions.onNoticeVisible) {
      actions.onNoticeVisible(item.id);
    }

    handleShopItemCardInteractions(input, itemRect, { item, canAfford: item.canAfford }, actions);
  });
}
