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
import { drawNoticeDot } from '../../../../components/button';
import { drawShopItemCard, getShopItemNoticeAnchor } from '../../../../components/cards/shop-item';
import { drawLazyLoader } from '../../../../components/utils/lazy-loader';
import { notices } from '../../../../managers/notices';

export function drawShopPanel(
  rect: Rect,
  items: ShopItemViewModel[]
) {
  if (items.length === 0) {
    drawLazyLoader(rect, 'Fetching items...');
    return;
  }

  const startX = rect.x;
  const startY = rect.y;
  const itemWidth = rect.width;
  const itemHeight = 100;
  const itemGap = 16;
  const noticeAnchors: Array<{ x: number; y: number; radius: number }> = [];

  items.forEach((item, index) => {
    const itemRect = {
      x: startX,
      y: startY + (itemHeight + itemGap) * index,
      width: itemWidth,
      height: itemHeight
    };

    drawShopItemCard(itemRect, { 
      item, 
      canAfford: item.canAfford,
      isHighlighted: item.isHighlighted,
      showNotice: false
    });

    const leafId = `leaf.shop_item.${item.id}.purchase_button`;
    if (!item.is_purchased && item.can_purchase && notices.hasLeafNotice(leafId)) {
      noticeAnchors.push(getShopItemNoticeAnchor(itemRect));
    }
  });

  for (const anchor of noticeAnchors) {
    drawNoticeDot(anchor.x, anchor.y, anchor.radius);
  }
}
