import type { BigNum } from "../core/bignum";

export type ChargeCrystalsState = {
  azure: number;
  aether: number;
  lucent: number;
  transcendent: number;
};

export type SisuTierId = "azure" | "aether" | "lucent" | "transcendent";

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

export type SisuState = {
  current: BigNum;
  max_basic: BigNum;
  max_upgrade_level: number;
  active_tier: SisuTierId;
  cycle_decay: number;
};

export type ProjectionParams = {
  current_fill: number;
  can_claim_at: string | null;
  current_sisu: BigNum;
  current_sisu_decay: number;
  sisu_at_claim: BigNum;
  sisu_decay_at_claim: number;
};

export type QuestState = {
  name: string;
  category: "main" | "daily";
  rank: number;
  max_rank: number;
  progress: number;
  claimed_rank: number;
};

export type StatsState = {
  total_achievements: number;
  total_quests_claimed: number;
  total_progress_claims: number;
  total_days_played: number;
  total_level_ups_daily: number;
  total_coins_earned: BigNum;
  total_shards_earned: BigNum;
  total_cores_earned: BigNum;
};

// Mirrors the server wire contract for visible snapshots. Persisted save JSON may
// contain more fields, but hidden or durable gameplay facts do not belong here
// unless the player is allowed to know and render them.
export type NoticeState = {
  active_leaf_ids: string[];
  active_parent_ids: string[];
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
  charge_crystals: ChargeCrystalsState;
  idle_mode: boolean;
  first_played_at: string | null;
  progress_bar: {
    reward_multiplier: number;
    rewards_claimed: number;
    };
    sisu: SisuState;
    areas: AreaDefinition[];
    features: {
      idle_mode_purchased: boolean;
      world_map_unlocked: boolean;
      sisu_generator_purchased: boolean;
      bonus_time_purchased: boolean;
    };
    shop: ShopItemDefinition[];
    quests: Record<string, QuestState>;
    stats: StatsState;
    projection_params: ProjectionParams;
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
  sisu: SisuState;
  notices: NoticeState;
} & ProjectionParams;

export type ProgressClaimRewardResult = {
  type: "progress.claim_reward.result";
  status: "ok";
  command_id: number;
  coins: BigNum;
  exp: BigNum;
  level: number;
  shards: BigNum;
  cores: BigNum;
  charge_crystals: ChargeCrystalsState;
  sisu: SisuState;
  notices: NoticeState;
};

export type SisuRefillResult = {
  type: "sisu.refill.result";
  status: "ok";
  command_id: number;
  tier_id: string;
  charge_crystals: ChargeCrystalsState;
  sisu: SisuState;
  notices: NoticeState;
} & ProjectionParams;

export type SisuUpgradeMaxResult = {
  type: "sisu.upgrade_max.result";
  status: "ok";
  command_id: number;
  sisu: SisuState;
  shards: BigNum;
  notices: NoticeState;
} & ProjectionParams;

export type AreaSelectResult = {
  type: "area.select.result";
  status: "ok";
  command_id: number;
  area: string;
  notices: NoticeState;
};

export type ShopPurchaseResult = {
  type: "shop.purchase.result";
  status: "ok";
  command_id: number;
  item_id: string;
  coins?: BigNum;
  shards?: BigNum;
  cores?: BigNum;
  sisu?: SisuState;
  notices: NoticeState;
} & Partial<ProjectionParams>;

export type ProgressSetIdleModeResult = {
  type: "progress.set_idle_mode.result";
  status: "ok";
  command_id: number;
  idle_mode: boolean;
  notices: NoticeState;
} & ProjectionParams;

export type QuestClaimResult = {
  type: "quest.claim.result";
  status: "ok";
  command_id: number;
  quest_id: string;
  coins: BigNum;
  quests: Record<string, QuestState>;
  stats: StatsState;
  notices: NoticeState;
} & ProjectionParams;


export type NoticeEventKind = "child_shown" | "child_clicked";

export type NoticeEventResult = {
  type: "notice.event.result";
  status: "ok";
  command_id: number;
  event: NoticeEventKind;
  leaf_id: string;
  notices: NoticeState;
};

export type CommandErrorReason =
  | "unknown_command"
  | "slot_index_required"
  | "invalid_slot_index"
  | "claim_not_ready"
  | "area_locked"
  | "unknown_area"
  | "tier_id_required"
  | "unknown_tier"
  | "sisu_generator_not_purchased"
  | "sisu_max_upgrade_reached"
  | "insufficient_shards"
  | "insufficient_charge_crystals"
  | "sisu_already_higher"
  | "sisu_charge_pending"
  | "upgrade_cost_missing"
  | "notice_event_required"
  | "invalid_notice_event"
  | "leaf_id_required"
  | "quest_id_required"
  | "quest_not_found"
  | "no_rewards_to_claim"
  | "rank_definition_not_found";

export type CommandErrorResult = {
  type: "command.error";
  status: "error";
  command_id: number;
  reason: CommandErrorReason;
  active_save_slot?: number;
  can_claim_in?: number;
  sisu?: SisuState;
  can_claim_at?: string | null;
};

export type AckableCommandResult =
  | GameNoopResult
  | SaveSlotsListResult
  | SaveSlotSwitchResult
  | SaveSlotResetResult
  | ProgressClaimInResult
  | ProgressClaimRewardResult
  | SisuRefillResult
  | SisuUpgradeMaxResult
  | AreaSelectResult
  | ShopPurchaseResult
  | ProgressSetIdleModeResult
  | QuestClaimResult
  | NoticeEventResult
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
  server_time: string;
  active_save_slot: number;
  save_slot: SaveSlotSummary;
  idle_mode: boolean;
  projection_params: ProjectionParams;
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
    result.type === "sisu.refill.result" ||
    result.type === "sisu.upgrade_max.result" ||
    result.type === "area.select.result" ||
    result.type === "shop.purchase.result" ||
    result.type === "progress.set_idle_mode.result" ||
    result.type === "quest.claim.result" ||
    result.type === "notice.event.result" ||
    result.type === "command.error"
  );
}
