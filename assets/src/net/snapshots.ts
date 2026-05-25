import type {
  GameSnapshot,
  ChargeCrystalsState,
  NoticeState,
  ServerResult,
  AreaSelectResult,
  NoticeEventResult,
  SisuState,
  QuestState,
  AchievementState,
  StatsState,
  CloverHuntState,
  AreaDefinition,
  ClimateState
} from "./protocol";
import type { BigNum } from "../core/bignum";
import { updateAreaViewModel } from "../features/areas/view-model";
import { synchronize } from "../core/time";

export enum View {
  GAME = "game",
  BONUSTIME = "bonustime"
}

const AUTHORITATIVE_AND_PROJECTION_RESULT_TYPES = new Set<ServerResult["type"]>([
  "shop.purchase.result",
  "sisu.refill.result",
  "sisu.upgrade_max.result",
  "furnace.upgrade.result",
  "quest.claim.result",
  "stats.update.result",
  "cloverfield.search.result",
  "cloverfield.confirm_discovery.result",
  "bonustime.play.result"
]);

export type ServerState = {
  snapshot: GameSnapshot | null;
  status: string;
  statusTone: "ok" | "error" | "";
  currentView: View;
  uiHints: {
    highlightedShopItemId: string | null;
  };
};

export function createServerState(): ServerState {
  return {
    snapshot: null,
    status: "Connecting...",
    statusTone: "",
    currentView: View.GAME,
    uiHints: {
      highlightedShopItemId: null
    }
  };
}

// Applies whatever authoritative state the result contains, and leaves everything
// else unchanged. This matches the protocol: narrow command results should not
// force the server to resend a full snapshot just to update UI status.
export function applyResult(state: ServerState, result: ServerResult): void {
  const snapshot = snapshotFromResult(result);

  if ("server_time" in result && typeof result.server_time === "string") {
    synchronize(result.server_time);
  } else if (snapshot) {
    synchronize(snapshot.server_time);
  }

  if (snapshot) {
    state.snapshot = snapshot;
    updateAreaViewModel(snapshot.state);
  }

  if (result.type === "progress.claim_reward.result") {
    applyAuthoritativeData(state, result);
    applyProjectionData(state, result);
  }

  if ("climate" in result && result.climate) {
    applyAuthoritativeData(state, result as any);
  }

  if (result.type === "progress.claim_in.result" || result.type === "progress.set_idle_mode.result") {
    applyProjectionData(state, result);
  }

  if (result.type === "command.error" && result.reason === "claim_not_ready") {
    applyProjectionData(state, result);
  }

  if (result.type === "area.select.result") {
    applyAreaResult(state, result);
  }

  if (AUTHORITATIVE_AND_PROJECTION_RESULT_TYPES.has(result.type)) {
    applyAuthoritativeData(state, result);
    applyProjectionData(state, result as any);
  }

  if (result.type === "progress.set_idle_mode.result" && state.snapshot) {
    state.snapshot.state.idle_mode = result.idle_mode;
  }

  if ("notices" in result && result.notices) {
    applyNoticeState(state, result.notices);
  }

  if (result.type === "notice.event.result") {
    applyNoticeResult(state, result);
  }

  state.statusTone = result.status === "error" ? "error" : "ok";
  state.status = statusForResult(result);
}

export function applyAuthoritativeData(
  state: ServerState,
  data: {
    fame?: BigNum;
    required_fame?: BigNum;
    trust?: number;
    coins?: BigNum;
    exp?: BigNum;
    level?: number;
    shards?: BigNum;
    cores?: BigNum;
    charge_crystals?: ChargeCrystalsState;
    item_id?: string;
    sisu?: SisuState;
    quests?: Record<string, QuestState>;
    achievements?: Record<string, AchievementState>;
    stats?: StatsState;
    area?: string;
    areas?: AreaDefinition[];
    furnace_level?: number;
    clover_hunt?: CloverHuntState;
    climate?: ClimateState;
    [key: string]: any;
  }
) {
  if (!state.snapshot) return;

  if (data.fame !== undefined) state.snapshot.state.fame = data.fame;
  if (data.required_fame !== undefined) state.snapshot.state.required_fame = data.required_fame;
  if (data.trust !== undefined) state.snapshot.state.trust = data.trust;
  if (data.coins !== undefined) state.snapshot.state.coins = data.coins;
  if (data.exp !== undefined) state.snapshot.state.exp = data.exp;
  if (data.level !== undefined) {
    state.snapshot.state.level = data.level;
    
    // Update shop item purchase eligibility
    for (const item of state.snapshot.state.shop) {
      item.can_purchase = !item.is_purchased && state.snapshot.state.level >= item.required_level;
    }

    // Keep server-provided dynamic locks (lock_reason) authoritative.
    // Recompute only level-gated locking locally when needed.
    for (const area of state.snapshot.state.areas) {
      const hasDynamicLock = typeof area.lock_reason === "string" && area.lock_reason.length > 0;
      area.is_locked = hasDynamicLock || state.snapshot.state.level < area.unlock_level;
    }

    updateAreaViewModel(state.snapshot.state);
  }

  if (data.shards !== undefined) state.snapshot.state.shards = data.shards;
  if (data.cores !== undefined) state.snapshot.state.cores = data.cores;
  if (data.charge_crystals !== undefined) state.snapshot.state.charge_crystals = data.charge_crystals;
  if (data.sisu !== undefined) state.snapshot.state.sisu = data.sisu;
  if (data.quests !== undefined) state.snapshot.state.quests = data.quests;
  if (data.achievements !== undefined) state.snapshot.state.achievements = data.achievements;
  if (data.stats !== undefined) state.snapshot.state.stats = data.stats;
  if (data.clover_hunt !== undefined) state.snapshot.state.clover_hunt = data.clover_hunt;
  if (data.furnace_level !== undefined) state.snapshot.state.furnace_level = data.furnace_level;
  if (data.has_bonustime_token !== undefined) state.snapshot.state.has_bonustime_token = data.has_bonustime_token;
  if (data.bonustime !== undefined) state.snapshot.state.bonustime = data.bonustime;
  if (data.area !== undefined) state.snapshot.state.area = data.area;
  if (data.areas !== undefined) state.snapshot.state.areas = data.areas;
  if (data.climate !== undefined) state.snapshot.state.climate = data.climate;

  if (data.item_id !== undefined) {
    const item = state.snapshot.state.shop.find(i => i.id === data.item_id);
    if (item) {
      item.is_purchased = true;
      item.can_purchase = false;

      // Authoritatively update feature flags based on the purchased item ID
      switch (data.item_id) {
        case "idle_mode":
          state.snapshot.state.features.idle_mode_purchased = true;
          break;
        case "sisu_generator":
          state.snapshot.state.features.sisu_generator_purchased = true;
          break;
        case "bonus_time":
          state.snapshot.state.features.bonus_time_purchased = true;
          break;
      }
    }
  }

  if (data.area !== undefined || data.areas !== undefined || data.clover_hunt !== undefined) {
    updateAreaViewModel(state.snapshot.state);
  }
}

export function applyProjectionData(
  state: ServerState,
  data: {
    current_fill?: number;
    can_claim_at?: string | null;
    current_sisu?: BigNum;
    current_sisu_decay?: number;
    sisu_at_claim?: BigNum;
    sisu_decay_at_claim?: number;
    sisu?: SisuState;
    color?: readonly [number, number, number, number];
  }
) {
  if (!state.snapshot) return;

  if (data.current_fill !== undefined) {
    state.snapshot.state.projection_params.current_fill = data.current_fill;
  }

  if (data.can_claim_at !== undefined) {
    state.snapshot.state.projection_params.can_claim_at = data.can_claim_at;
  }

  if (data.current_sisu !== undefined) {
    state.snapshot.state.projection_params.current_sisu = data.current_sisu;
  }

  if (data.current_sisu_decay !== undefined) {
    state.snapshot.state.projection_params.current_sisu_decay = data.current_sisu_decay;
  }

  if (data.sisu_at_claim !== undefined) {
    state.snapshot.state.projection_params.sisu_at_claim = data.sisu_at_claim;
  }

  if (data.sisu_decay_at_claim !== undefined) {
    state.snapshot.state.projection_params.sisu_decay_at_claim = data.sisu_decay_at_claim;
  }

  if (data.sisu !== undefined) {
    state.snapshot.state.sisu = data.sisu;
  }
}

export function applyAreaResult(state: ServerState, result: AreaSelectResult) {
  if (!state.snapshot) return;
  state.snapshot.state.area = result.area;
  updateAreaViewModel(state.snapshot.state);
}

export function applyNoticeState(state: ServerState, notices: NoticeState) {
  if (!state.snapshot) return;
  state.snapshot.notices.active_leaf_ids = notices.active_leaf_ids;
  state.snapshot.notices.active_parent_ids = notices.active_parent_ids;
}

export function applyNoticeResult(state: ServerState, result: NoticeEventResult) {
  if (!state.snapshot) return;
  applyNoticeState(state, result.notices);
}

function snapshotFromResult(result: ServerResult): GameSnapshot | null {
  if (result.type === "game.reset.result") {
    return result.snapshot ?? null;
  }

  return null;
}

function statusForResult(result: ServerResult): string {
  if (result.status === "error") return result.reason || "Command rejected";
  if (result.type === "command.queued") return "Queued";
  if (result.type === "game.noop.result") return "Synced";
  if (result.type === "time.sync.result") return "Clock synced";
  if (result.type === "game.reset.result") return "Game reset";
  if (result.type === "shop.purchase.result") return "Purchase successful";
  if (result.type === "furnace.upgrade.result") return "Furnace upgraded";
  return "Ready";
}

export function clearShopHighlight(state: ServerState) {
  state.uiHints.highlightedShopItemId = null;
}
