import unlocking from "../../../shared/requirements/unlocking.json";
import furnace from "../../../shared/requirements/furnace.json";
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
type SharedFurnaceLevelEntry = {
  level: number;
  name: string;
  description: string;
};

type SharedFurnaceRequirements = {
  levels: SharedFurnaceLevelEntry[];
};

const sharedUnlocking = unlocking as SharedUnlockEntry[];
const sharedFurnace = furnace as SharedFurnaceRequirements;

const sharedAreaUnlocking = sharedUnlocking.filter(
  (entry): entry is SharedAreaUnlockEntry => entry.type === "area"
);

const sharedShopUnlocking = sharedUnlocking.filter(
  (entry): entry is SharedShopUnlockEntry => entry.type === "shop-item"
);

const sharedAreaPresentationById = Object.freeze(
  Object.fromEntries(sharedAreaUnlocking.map((area) => [area.id, { name: area.name, description: area.description }])) as Record<
    string,
    { name: string; description: string }
  >
);

const sharedFurnaceLevels = [...sharedFurnace.levels].sort((a, b) => a.level - b.level);

if (sharedFurnaceLevels.length === 0) {
  throw new Error("shared/requirements/furnace.json must define at least one furnace level");
}

const furnaceLevelByNumber = Object.freeze(
  Object.fromEntries(sharedFurnaceLevels.map((entry) => [entry.level, entry])) as Partial<
    Record<number, SharedFurnaceLevelEntry>
  >
);

export const FURNACE_MIN_LEVEL = sharedFurnaceLevels[0].level;
export const FURNACE_MAX_LEVEL = sharedFurnaceLevels[sharedFurnaceLevels.length - 1].level;

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

export function getAreaPresentation(areaId: string) {
  return sharedAreaPresentationById[areaId];
}

export function getFurnaceLevelPresentation(level: number) {
  const clampedLevel = Math.max(FURNACE_MIN_LEVEL, Math.min(FURNACE_MAX_LEVEL, Math.floor(level)));
  return furnaceLevelByNumber[clampedLevel] ?? sharedFurnaceLevels[0];
}

export function formatUnlockRequirement(requiredLevel: number, currentLevel?: number) {
  if (currentLevel !== undefined && currentLevel >= requiredLevel) {
    return "Unlock";
  }
  return `Requires Level ${requiredLevel}`;
}
