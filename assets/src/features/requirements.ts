import unlocking from "../../../shared/requirements/unlocking.json";
import type { BigNum } from "../core/bignum";

type ShopCurrency = "coins" | "shards" | "cores";

export type ShopItemId = "idle_mode" | "sisu_generator" | "bonus_time";
export type ShopUnlockableItemId = ShopItemId;
export type ShopPricedItemId = ShopItemId;

type SharedAreaUnlockEntry = {
  type: "area";
  id: string;
  name: string;
  description: string;
  required_level: number;
};

type SharedShopUnlockEntry = {
  type: "shop-item";
  id: ShopItemId;
  name: string;
  description: string;
  cost: BigNum;
  currency: ShopCurrency;
  required_level: number;
};

type SharedUnlockEntry = SharedAreaUnlockEntry | SharedShopUnlockEntry;

const sharedUnlocking = unlocking as SharedUnlockEntry[];

const sharedAreaUnlocking = sharedUnlocking.filter(
  (entry): entry is SharedAreaUnlockEntry => entry.type === "area"
);

const sharedShopUnlocking = sharedUnlocking.filter(
  (entry): entry is SharedShopUnlockEntry => entry.type === "shop-item"
);

export const AREA_UNLOCK_REQUIRED_LEVELS = Object.freeze(
  Object.fromEntries(sharedAreaUnlocking.map((area) => [area.id, area.required_level])) as Record<string, number>
);

export const SHOP_UNLOCK_REQUIRED_LEVELS = Object.freeze(
  Object.fromEntries(sharedShopUnlocking.map((item) => [item.id, item.required_level])) as Record<
    ShopUnlockableItemId,
    number
  >
);

export const SHOP_ITEM_COSTS = Object.freeze(
  Object.fromEntries(
    sharedShopUnlocking.map((item) => [item.id, { cost: item.cost, currency: item.currency }])
  ) as Record<ShopPricedItemId, { cost: BigNum; currency: ShopCurrency }>
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
