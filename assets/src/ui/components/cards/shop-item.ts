import { COLORS } from '../../../colors';
import {
  SHOP_ITEM_NAME_FONT,
  SHOP_ITEM_DESC_FONT,
  SHOP_ITEM_COST_FONT,
  SHOP_ITEM_REQ_FONT
} from '../../../config';
import { formatBigNum, formatLevel } from '../../../format';
import { Rect } from '../tab-menu/tab-menu';
import { InteractionState, pointInRect } from '../../interaction-manager';
import { drawButton } from '../button';
import { drawCurrencyAmount } from '../../../render/currency-icons';
import { ShopItemDefinition } from '../../../net/protocol';

export interface ShopItemActions {
  onPurchase: (itemId: string) => void;
}

export interface ShopItemCardProps {
  item: ShopItemDefinition;
  canAfford: boolean;
}

export function drawShopItemCard(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  props: ShopItemCardProps
) {
  const { item, canAfford } = props;
  const isPurchased = item.is_purchased;

  ctx.save();

  // Background
  ctx.fillStyle = COLORS.button.surface.inactive;

  let opacity = 1.0;
  if (isPurchased) {
    opacity = 0.25; // Very reduced opacity for owned items
  } else if (!item.can_purchase) {
    opacity = 0.7; // A little reduced opacity for locked items
  }

  ctx.globalAlpha = opacity;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  // Border
  ctx.strokeStyle = COLORS.button.border.inactive;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  // Name
  ctx.fillStyle = COLORS.panel.textPrimary;
  ctx.font = SHOP_ITEM_NAME_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(item.name, rect.x + 16, rect.y + 16);

  // Description
  ctx.fillStyle = COLORS.panel.textSecondary;
  ctx.font = SHOP_ITEM_DESC_FONT;
  ctx.fillText(item.description, rect.x + 16, rect.y + 44);

  // Cost / Status
  if (isPurchased) {
    ctx.fillStyle = COLORS.overlay.statusUnlocked;
    ctx.font = SHOP_ITEM_NAME_FONT;
    ctx.textAlign = 'right';
    ctx.fillText('OWNED', rect.x + rect.width - 16, rect.y + 16);
  } else {
    drawCurrencyAmount(
      ctx,
      item.currency,
      item.cost,
      rect.x + rect.width - 16,
      rect.y + 16,
      24,
      {
        align: 'right',
        font: SHOP_ITEM_COST_FONT,
        textColor: COLORS.hud[item.currency] || COLORS.panel.textPrimary,
        iconGap: 6,
        iconPosition: 'right',
        formatter: formatBigNum
      }
    );

    if (!item.can_purchase) {
      ctx.fillStyle = COLORS.panel.textSecondary;
      ctx.font = SHOP_ITEM_REQ_FONT;
      ctx.textAlign = 'right';
      ctx.fillText(
        `Requires ${formatLevel(item.required_level)}`,
        rect.x + rect.width - 16,
        rect.y + 44
      );
    } else {
      const btnWidth = 120;
      const btnHeight = 32;
      const btnRect = {
        x: rect.x + rect.width - btnWidth - 16,
        y: rect.y + rect.height - btnHeight - 16,
        width: btnWidth,
        height: btnHeight
      };

      // Just draw the button, don't handle logic here
      drawButton(ctx, btnRect, 'Purchase', {
        active: canAfford,
        textColor: canAfford ? COLORS.button.text : COLORS.panel.textSecondary
      });
    }
  }

  ctx.restore();
}

export function handleShopItemCardInteractions(
  input: InteractionState,
  rect: Rect,
  props: ShopItemCardProps,
  actions: ShopItemActions
) {
  const { item, canAfford } = props;

  if (item.is_purchased || !item.can_purchase || !canAfford) return;

  const btnWidth = 120;
  const btnHeight = 32;
  const btnRect = {
    x: rect.x + rect.width - btnWidth - 16,
    y: rect.y + rect.height - btnHeight - 16,
    width: btnWidth,
    height: btnHeight
  };

  if (pointInRect(input.pointer, btnRect) &&
    pointInRect(input.pressStartPointer, btnRect) &&
    input.clicked && !input.consumed) {
    actions.onPurchase(item.id);
    input.consumed = true;
  }
}
