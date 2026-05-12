import { COLORS } from '../../../colors';
import {
  SHOP_ITEM_NAME_FONT,
  SHOP_ITEM_DESC_FONT,
  SHOP_ITEM_COST_FONT,
  SHOP_ITEM_REQ_FONT
} from '../../../config';
import { formatBigNum, formatLevel } from '../../../utils';
import { Rect } from '../tab-menu/tab-menu';
import { InteractionState, pointInRect } from '../../managers/interactions';
import { drawButton } from '../button';
import { drawCurrencyAmount } from '../../../render/currency-icons';
import { ShopItemDefinition } from '../../../net/protocol';
import { notices } from '../../managers/notices';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

export interface ShopItemActions {
  onPurchase: (itemId: string) => void;
  onNoticeClick?: (itemId: string) => void;
  onNoticeVisible?: (itemId: string) => void;
}

export interface ShopItemCardProps {
  item: ShopItemDefinition;
  canAfford: boolean;
  isHighlighted?: boolean;
}

export function drawShopItemCard(
  rect: Rect,
  props: ShopItemCardProps
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) {
    return;
  }

  const { item, canAfford, isHighlighted } = props;
  const isPurchased = item.is_purchased;

  let opacity = 1.0;
  if (isPurchased) {
    opacity = 0.25; // Very reduced opacity for owned items
  } else if (!item.can_purchase) {
    opacity = 0.7; // A little reduced opacity for locked items
  }

  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: cssToRgba(COLORS.button.surface.inactive, opacity)
  });
  const borderColor = isHighlighted ? COLORS.overlay.statusUnlocked : COLORS.button.border.inactive;
  const borderWidth = isHighlighted ? 4 : 2;
  drawRectOutline(renderer, rect.x, rect.y, rect.width, rect.height, borderWidth, cssToRgba(borderColor));
  if (isHighlighted) {
    drawRectOutline(
      renderer,
      rect.x - 2,
      rect.y - 2,
      rect.width + 4,
      rect.height + 4,
      2,
      cssToRgba(COLORS.overlay.statusUnlocked, 0.45)
    );
  }

  renderer.drawText({
    text: item.name,
    x: rect.x + 16,
    y: rect.y + 16,
    font: SHOP_ITEM_NAME_FONT,
    color: COLORS.panel.textPrimary,
    align: 'left',
    baseline: 'top'
  });
  renderer.drawText({
    text: item.description,
    x: rect.x + 16,
    y: rect.y + 44,
    font: SHOP_ITEM_DESC_FONT,
    color: COLORS.panel.textSecondary,
    align: 'left',
    baseline: 'top'
  });

  // Cost / Status
  if (isPurchased) {
    renderer.drawText({
      text: 'OWNED',
      x: rect.x + rect.width - 16,
      y: rect.y + 16,
      font: SHOP_ITEM_NAME_FONT,
      color: COLORS.overlay.statusUnlocked,
      align: 'right',
      baseline: 'top'
    });
  } else {
    drawCurrencyAmount(
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
      renderer.drawText({
        text: `Requires ${formatLevel(item.required_level)}`,
        x: rect.x + rect.width - 16,
        y: rect.y + 44,
        font: SHOP_ITEM_REQ_FONT,
        color: COLORS.panel.textSecondary,
        align: 'right',
        baseline: 'top'
      });
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
      drawButton(btnRect, 'Purchase', {
        active: canAfford,
        textColor: canAfford ? COLORS.button.text : COLORS.panel.textSecondary,
        showNotice: notices.hasLeafNotice(`leaf.shop_item.${item.id}.purchase_button`),
        showNoticePing: true
      });
    }
  }
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
    
    // Clear notice on interaction
    const leafId = `leaf.shop_item.${item.id}.purchase_button`;
    if (notices.hasLeafNotice(leafId) && actions.onNoticeClick) {
      actions.onNoticeClick(item.id);
    }

    if (canAfford) {
      actions.onPurchase(item.id);
    }
    
    input.consumed = true;
  }
}

function drawRectOutline(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  x: number,
  y: number,
  width: number,
  height: number,
  borderWidth: number,
  color: [number, number, number, number]
) {
  const stroke = Math.max(1, Number.isFinite(borderWidth) ? borderWidth : 1);
  renderer.drawRect({ x, y, width, height: stroke, color });
  renderer.drawRect({ x, y: y + height - stroke, width, height: stroke, color });
  renderer.drawRect({ x, y, width: stroke, height, color });
  renderer.drawRect({ x: x + width - stroke, y, width: stroke, height, color });
}

function cssToRgba(color: string, alphaMultiplier = 1): [number, number, number, number] {
  const normalized = String(color || '').trim();
  const match = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!match) return [1, 1, 1, clamp01(alphaMultiplier)];
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return [r, g, b, clamp01(alphaMultiplier)];
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
