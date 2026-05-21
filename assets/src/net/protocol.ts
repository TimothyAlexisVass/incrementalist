import type { BigNum } from "../core/bignum";

export type ChargeCrystalsState = {
  azure: number;
  aether: number;
  lucent: number;
  transcendent: number;
};

export type SisuTierId = "azure" | "aether" | "lucent" | "transcendent";

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
  fame?: BigNum;
  favor?: number;
};

export type AchievementState = {
  name: string;
  multiplier: number;
  condition: string;
  favor: number;
  unlocked_at: string | null;
};

export type StatsState = {
  total_achievements: number;
  total_quests_claimed: number;
  total_favor: number;
  total_progress_claims: number;
  total_days_played: number;
  total_level_ups_daily: number;
  screens_viewed_stats: boolean;
  screens_viewed_quests: boolean;
  screens_viewed_achievements: boolean;
  tutorial_graduated: boolean;
  total_coins_earned: BigNum;
  total_shards_earned: BigNum;
  total_cores_earned: BigNum;
};

// Mirrors the server wire contract for visible snapshots. Persisted save JSON may
// contain more fields, but hidden or durable gameplay facts do not belong here
// unless the player is allowed to know and render them.
export type BonusTimeState = {
  special_tokens: number;
  last_token_boundary_index: number;
  streak: number;
  last_played_at: string | null;
  total_games_played: number;
  reward_counts: Record<string, number>;
  checklist_entry_indexes: Record<string, number>;
  last_result: any | null;
  jackpot_progress?: number;
  rotation_anchor?: string;
  active_game_id?: string;
  bonustime_flips?: number;
  active_session?: {
    type: string;
    data: Record<string, unknown>;
  } | null;
};

export type NoticeState = {
  active_leaf_ids: string[];
  active_parent_ids: string[];
};

export type GameSnapshot = {
  type: "game.snapshot";
  server_time: string;
  state: {
    area: string;
  level: number;
  trust: number;
  exp: BigNum;
  required_exp: BigNum;
  fame: BigNum;
  required_fame: BigNum;
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
    achievements: Record<string, AchievementState>;
    stats: StatsState;
    bonustime: BonusTimeState | null;
    has_bonustime_token: boolean;
    projection_params: ProjectionParams;
  };
  notices: NoticeState;
};

export type GameNoopResult = {
  type: "game.noop.result";
  status: "ok";
  command_id: number;
  server_time: string;
  events: unknown[];
};

export type GameResetResult = {
  type: "game.reset.result";
  status: "ok";
  command_id: number;
  server_time: string;
  snapshot: GameSnapshot;
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
  trust: number;
  fame: BigNum;
  required_fame: BigNum;
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
  trust: number;
  fame: BigNum;
  required_fame: BigNum;
  quests: Record<string, QuestState>;
  achievements: Record<string, AchievementState>;
  stats: StatsState;
  notices: NoticeState;
} & ProjectionParams;

export type StatsUpdateResult = {
  type: "stats.update.result";
  status: "ok";
  command_id: number;
  stats: StatsState;
  achievements: Record<string, AchievementState>;
  notices: NoticeState;
};

export type BonusTimePlayResult = {
  type: "bonustime.play.result";
  status: "ok";
  command_id: number;
  coins?: BigNum;
  has_bonustime_token?: boolean;
  bonustime?: BonusTimeState;
  achievements?: Record<string, AchievementState>;
  notices: NoticeState;
};


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
  | "rank_definition_not_found"
  | "screen_id_required"
  | "unknown_screen"
  | "no_tokens"
  | "game_not_available"
  | "game_id_required"
  | "invalid_request";

export type CommandErrorResult = {
  type: "command.error";
  status: "error";
  command_id: number;
  reason: CommandErrorReason;
  can_claim_in?: number;
  sisu?: SisuState;
  can_claim_at?: string | null;
};

export type AckableCommandResult =
  | GameNoopResult
  | GameResetResult
  | ProgressClaimInResult
  | ProgressClaimRewardResult
  | SisuRefillResult
  | SisuUpgradeMaxResult
  | AreaSelectResult
  | ShopPurchaseResult
  | ProgressSetIdleModeResult
  | QuestClaimResult
  | StatsUpdateResult
  | NoticeEventResult
  | BonusTimePlayResult
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
  idle_mode: boolean;
  projection_params: ProjectionParams;
  snapshot?: GameSnapshot | null;
  pending_result?: AckableCommandResult | null;
};

export function isAckableCommandResult(result: ServerResult): result is AckableCommandResult {
  return (
    result.type === "game.noop.result" ||
    result.type === "game.reset.result" ||
    result.type === "progress.claim_in.result" ||
    result.type === "progress.claim_reward.result" ||
    result.type === "sisu.refill.result" ||
    result.type === "sisu.upgrade_max.result" ||
    result.type === "area.select.result" ||
    result.type === "shop.purchase.result" ||
    result.type === "progress.set_idle_mode.result" ||
    result.type === "quest.claim.result" ||
    result.type === "stats.update.result" ||
    result.type === "notice.event.result" ||
    result.type === "bonustime.play.result" ||
    result.type === "command.error"
  );
}
