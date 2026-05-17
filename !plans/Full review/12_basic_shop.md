# Step 12: Shop Review Plan

This step governs shop item listings, currencies, cost deductions, purchasing commands, purchase pings, and visual bottom-hud navigation integrations.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Shop Panel (`renderBasicShopTab`)**: Rendered inside `assets/src/ui/layout/main-menu/panels/basic-shop/render.ts`.
- **Card Drawing (`drawShopItemCard`)**:
  - Locked items: Reduced opacity (0.7) and text `Requires Level X`.
  - Unlocked items: Displays item name, description, cost value, and corresponding currency icon (Coin, Shard, or Core).
  - Owned items: Opacity is reduced to 0.25, and text draws green `'OWNED'`.
- **Purchase Click Interactions (`handleShopItemCardInteractions`)**:
  - Validates cost and afford status.
  - Clicking the buy button emits `shopPurchase(channel, itemId)` (`assets/src/net/commands.ts`).
  - Clears active notice dots on click.
- **HUD Lock Updates**: Purchasing a feature immediately updates locked indicators across HUD buttons (e.g. unlocks Sisu control panel, unlocks world map, unlocks Bonus Time tab).

### Server (Elixir)
- **Purchase Gating (`Shop.purchase/2`)**:
  - Gaters: `fetch_item`, `check_not_purchased`, `check_level_requirement`, `deduct_cost`.
  - Cost is checked and deducted using `BigNum` calculations against the respective balance.
- **Purchase Effects (`apply_purchase_effects/2`)**:
  - Sets corresponding purchased indicators to `true` (e.g., `idle_mode_purchased: true`).
  - Returns the updated feature flags in the command result snapshot.

---

## Step-by-Step Execution Verification Plan

### 1. Locked Items Level Gating
- **Verify**: Open the Shop at Level 1.
- **Verify**: Items with high level requirements (e.g. `sisu_generator` requires Level 25) display `"Requires Level 25"`.
- **Verify**: Level up to 25.
- **Verify**: The requirement text is replaced by the cost button, and the item's visual opacity increases.

### 2. Multi-Currency Deductions
- **Verify**: purchase `idle_mode` (costs Coins). Balance is deducted.
- **Verify**: purchase `sisu_generator` (costs Shards). Shards balance is deducted.
- **Verify**: purchase `bonus_time` (costs Cores). Cores balance is deducted.
- **Verify**: Test attempting to purchase an item without sufficient funds. The server must return an `"insufficient_X"` error, and the purchase must be rejected.

### 3. Click Interactions & Notices
- **Verify**: Click the buy button of a purchasable item.
- **Verify**: The click hit-test registers inside `btnRect` boundary coordinates.
- **Verify**: The local notice dot clears instantly, and the `shop.purchase` command is sent.

### 4. Owned Visual Treatment
- **Verify**: Once purchased, the shop card updates to `OWNED` status.
- **Verify**: The card's visual opacity falls to 0.25, pushing it visually to the background to let other active items stand out.
