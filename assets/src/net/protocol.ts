export type SaveSlotSummary = {
  slot_index: number;
  file_index: number;
  is_current: boolean;
  has_data: boolean;
  level: number;
  rewards_claimed: number;
  saved_at: string | null;
};

// Mirrors the server wire contract for visible snapshots. Persisted save JSON may
// contain more fields, but hidden or durable gameplay facts do not belong here
// unless the player is allowed to know and render them.
export type GameSnapshot = {
  type: "game.snapshot";
  server_time: string;
  active_save_slot: number;
  state: {
    area: string;
    level: number;
    exp: number;
    required_exp: number;
    coins: number;
    shards: number;
    cores: number;
    progress_bar: {
      fill: number;
      sisu: number;
      reward_multiplier: number;
      rewards_claimed: number;
    };
  };
  save_slot: SaveSlotSummary;
};

export type GameNoopResult = {
  type: "game.noop.result";
  status: "ok";
  server_time: string;
  events: unknown[];
};

export type SaveSlotsListResult = {
  type: "save_slots.list.result";
  status: "ok";
  server_time: string;
  active_save_slot: number;
  slots: SaveSlotSummary[];
};

export type SaveSlotSwitchResult = {
  type: "save_slot.switch.result";
  status: "ok";
  server_time: string;
  active_save_slot: number;
  save_slot: SaveSlotSummary;
  slots: SaveSlotSummary[];
} & ({ snapshot: GameSnapshot } | { snapshot?: null });

export type SaveSlotResetResult = {
  type: "save_slot.reset.result";
  status: "ok";
  server_time: string;
  snapshot: GameSnapshot;
  slots: SaveSlotSummary[];
};

export type CommandErrorReason = "unknown_command" | "slot_index_required" | "invalid_slot_index";

export type CommandErrorResult = {
  type: "command.error";
  status: "error";
  reason: CommandErrorReason;
  active_save_slot?: number;
  command_type?: string;
};

export type AckableCommandResult =
  | GameNoopResult
  | SaveSlotsListResult
  | SaveSlotSwitchResult
  | SaveSlotResetResult
  | CommandErrorResult;

export type CommandQueuedResult = {
  type: "command.queued";
  status: "ok";
  command_type: string;
  queue_position: number;
};

export type CommandRejectedResult = {
  type: "command.rejected";
  status: "error";
  reason: "queue_full";
};

export type CommandAckResult = {
  type: "command.ack.result";
  status: "ok";
  acked: boolean;
  released_result: AckableCommandResult | null;
};

export type CommandPushResult<TExecuted extends AckableCommandResult> =
  | TExecuted
  | CommandQueuedResult
  | CommandRejectedResult;

// Command result shapes are exact. Fields that only make sense for one result
// stay on that result instead of becoming optional baggage on every response.
export type ServerResult =
  | AckableCommandResult
  | CommandQueuedResult
  | CommandRejectedResult
  | CommandAckResult;

export type BootResult = {
  type: "game.boot";
  anonymous_player_token?: string | null;
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
    result.type === "command.error"
  );
}
