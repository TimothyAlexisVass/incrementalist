import areas from "../../../shared/requirements/areas.json";
import sageTipLevels from "../../../shared/requirements/sage-tip-levels.json";
import shopItems from "../../../shared/requirements/shop-items.json";
import type { BigNum } from "../core/bignum";

type ShopCurrency = "coins" | "shards" | "cores";

type SharedShopItem = {
  id: ShopItemId;
  name: string;
  description: string;
  cost: BigNum;
  currency: ShopCurrency;
  required_level: number;
};

type SharedArea = {
  key: string;
  name: string;
  description: string;
  unlock_level: number;
};

export type ShopItemId = "idle_mode" | "sisu_generator" | "bonus_time";
export type ShopUnlockableItemId = ShopItemId;
export type ShopPricedItemId = ShopItemId;

const sharedAreas = areas as SharedArea[];
const sharedSageTipLevels = sageTipLevels as number[];
const sharedShopItems = shopItems as SharedShopItem[];

export const AREA_UNLOCK_REQUIRED_LEVELS = Object.freeze(
  Object.fromEntries(sharedAreas.map((area) => [area.key, area.unlock_level])) as Record<string, number>
);

export const SAGE_TIP_LEVELS = Object.freeze([...sharedSageTipLevels]);

export const SHOP_UNLOCK_REQUIRED_LEVELS = Object.freeze(
  Object.fromEntries(sharedShopItems.map((item) => [item.id, item.required_level])) as Record<ShopUnlockableItemId, number>
);

export const SHOP_ITEM_COSTS = Object.freeze(
  Object.fromEntries(sharedShopItems.map((item) => [item.id, { cost: item.cost, currency: item.currency }])) as Record<
    ShopPricedItemId,
    { cost: BigNum; currency: ShopCurrency }
  >
);

export function getShopItemRequiredLevel(
  shopItems: Array<{ id: string; required_level: number }> | undefined,
  itemId: ShopUnlockableItemId
) {
  return shopItems?.find((item) => item.id === itemId)?.required_level ?? SHOP_UNLOCK_REQUIRED_LEVELS[itemId];
}

export function getShopItemCost(itemId: ShopPricedItemId) {
  return SHOP_ITEM_COSTS[itemId];
}

export function formatUnlockRequirement(requiredLevel: number, currentLevel?: number) {
  if (currentLevel !== undefined && currentLevel >= requiredLevel) {
    return "Unlock";
  }
  return `Requires Level ${requiredLevel}`;
}
