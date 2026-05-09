import type { BigNum } from "../core/bignum";

export type SaveSlotSummary = {
  slot_index: number;
  file_index: number;
  is_current: boolean;
  has_data: boolean;
  level: number;
  rewards_claimed: number;
  saved_at: string | null;
};

export type AreaDefinition = {
  key: string;
  name: string;
  description: string;
  unlock_level: number;
  is_locked: boolean;
};

export type ShopItemDefinition = {
  id: string;
  name: string;
  description: string;
  cost: BigNum;
  currency: "coins" | "shards" | "cores";
  required_level: number;
  is_purchased: boolean;
  can_purchase: boolean;
};

// Mirrors the server wire contract for visible snapshots. Persisted save JSON may
// contain more fields, but hidden or durable gameplay facts do not belong here
// unless the player is allowed to know and render them.
export type NoticeState = {
  seen_leaf_ids: string[];
  last_ack_level: Record<string, number>;
  last_ack_time: Record<string, string>;
};

export type GameSnapshot = {
  type: "game.snapshot";
  server_time: string;
  active_save_slot: number;
  state: {
    area: string;
    level: number;
    exp: BigNum;
    required_exp: BigNum;
    coins: BigNum;
    shards: BigNum;
    cores: BigNum;
    idle_mode: boolean;
    first_played_at: string | null;
    progress_bar: {
      sisu: BigNum;
      reward_multiplier: number;
      rewards_claimed: number;
    };
    areas: AreaDefinition[];
    features: {
      idle_mode_purchased: boolean;
      world_map_unlocked: boolean;
      sisu_generator_purchased: boolean;
      bonus_time_purchased: boolean;
    };
    shop: ShopItemDefinition[];
  };
  notices: NoticeState;
  save_slot: SaveSlotSummary;
};

export type GameNoopResult = {
  type: "game.noop.result";
  status: "ok";
  command_id: number;
  server_time: string;
  events: unknown[];
};

export type SaveSlotsListResult = {
  type: "save_slots.list.result";
  status: "ok";
  command_id: number;
  server_time: string;
  active_save_slot: number;
  slots: SaveSlotSummary[];
};

export type SaveSlotSwitchResult = {
  type: "save_slot.switch.result";
  status: "ok";
  command_id: number;
  server_time: string;
  active_save_slot: number;
  save_slot: SaveSlotSummary;
  slots: SaveSlotSummary[];
} & ({ snapshot: GameSnapshot } | { snapshot?: null });

export type SaveSlotResetResult = {
  type: "save_slot.reset.result";
  status: "ok";
  command_id: number;
  server_time: string;
  snapshot: GameSnapshot;
  slots: SaveSlotSummary[];
};

export type ProgressClaimInResult = {
  type: "progress.claim_in.result";
  status: "ok";
  command_id: number;
  can_claim_in: number;
};

export type ProgressClaimRewardResult = {
  type: "progress.claim_reward.result";
  status: "ok";
  command_id: number;
  coins: BigNum;
  exp: BigNum;
  level: number;
  shards: BigNum;
  cores: BigNum;
};

export type AreaSelectResult = {
  type: "area.select.result";
  status: "ok";
  command_id: number;
  area: string;
};

export type ShopPurchaseResult = {
  type: "shop.purchase.result";
  status: "ok";
  command_id: number;
  item_id: string;
  coins?: BigNum;
  shards?: BigNum;
  cores?: BigNum;
};

export type NoticeSeeResult = {
  type: "notice.see.result";
  status: "ok";
  command_id: number;
  leaf_id: string;
};

export type NoticeAckResult = {
  type: "notice.ack.result";
  status: "ok";
  command_id: number;
  parent_id: string;
};

export type CommandErrorReason =
  | "unknown_command"
  | "slot_index_required"
  | "invalid_slot_index"
  | "claim_not_ready"
  | "area_locked"
  | "unknown_area";

export type CommandErrorResult = {
  type: "command.error";
  status: "error";
  command_id: number;
  reason: CommandErrorReason;
  active_save_slot?: number;
  can_claim_in?: number;
};

export type AckableCommandResult =
  | GameNoopResult
  | SaveSlotsListResult
  | SaveSlotSwitchResult
  | SaveSlotResetResult
  | ProgressClaimInResult
  | ProgressClaimRewardResult
  | AreaSelectResult
  | ShopPurchaseResult
  | NoticeSeeResult
  | NoticeAckResult
  | CommandErrorResult;

export type CommandQueuedResult = {
  type: "command.queued";
  status: "ok";
  command_id: number;
};

export type CommandAckResult = {
  type: "command.ack.result";
  status: "ok";
  command_id: number;
  released_result: AckableCommandResult | null;
};

export type CommandPushResult<TExecuted extends AckableCommandResult> =
  | TExecuted
  | CommandQueuedResult;

// Command result shapes are exact. Fields that only make sense for one result
// stay on that result instead of becoming optional baggage on every response.
export type ServerResult =
  | AckableCommandResult
  | CommandQueuedResult
  | CommandAckResult;

export type BootResult = {
  type: "game.boot";
  username: string;
  token?: string;
  active_save_slot: number;
  save_slot: SaveSlotSummary;
  snapshot?: GameSnapshot | null;
  pending_result?: AckableCommandResult | null;
};

export function isAckableCommandResult(result: ServerResult): result is AckableCommandResult {
  return (
    result.type === "game.noop.result" ||
    result.type === "save_slots.list.result" ||
    result.type === "save_slot.switch.result" ||
    result.type === "save_slot.reset.result" ||
    result.type === "progress.claim_in.result" ||
    result.type === "progress.claim_reward.result" ||
    result.type === "area.select.result" ||
    result.type === "shop.purchase.result" ||
    result.type === "notice.see.result" ||
    result.type === "notice.ack.result" ||
    result.type === "command.error"
  );
}
