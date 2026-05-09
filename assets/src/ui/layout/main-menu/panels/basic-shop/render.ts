import { COLORS } from '../../../../../colors';
import { ShopItemViewModel } from './view-model';
import { formatBigNum, formatLevel } from '../../../../../utils';
import { 
  SHOP_ITEM_NAME_FONT, 
  SHOP_ITEM_DESC_FONT, 
  SHOP_ITEM_COST_FONT, 
  SHOP_ITEM_REQ_FONT 
} from '../../../../../config';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { drawShopItemCard } from '../../../../components/cards/shop-item';
import { drawLazyLoader } from '../../../../components/utils/lazy-loader';

export function drawShopPanel(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  items: ShopItemViewModel[]
) {
  if (items.length === 0) {
    drawLazyLoader(ctx, rect, 'Fetching items...');
    return;
  }

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

    drawShopItemCard(ctx, itemRect, { item, canAfford: item.canAfford });
  });
}
