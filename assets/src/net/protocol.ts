export type SaveSlotSummary = {
  slot_index: number;
  file_index: number;
  is_current: boolean;
  has_data: boolean;
  level: number;
  rewards_claimed: number;
  saved_at: string | null;
  state_version: number;
};

export type GameSnapshot = {
  type: "game.snapshot";
  server_time: string;
  active_save_slot: number;
  state_version: number;
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

export type ServerResult = {
  type: string;
  status: "ok" | "error";
  requires_ack?: boolean;
  reason?: string;
  snapshot?: GameSnapshot;
  slots?: SaveSlotSummary[];
  next_result?: ServerResult | null;
};

export type BootResult = {
  type: "game.boot";
  anonymous_player_token?: string | null;
  snapshot: GameSnapshot;
  pending_result?: ServerResult | null;
};
