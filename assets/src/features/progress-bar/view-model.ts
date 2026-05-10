import type { GameSnapshot, ProgressClaimInResult, ProgressClaimRewardResult, ServerResult } from "../../net/protocol";
import { BigNum, toNumber, ZERO } from "../../core/bignum";
import {
  BAR_RESET_LERP_SPEED,
} from "../../config";
import { spawnProgressClaimRewardEffects, type ResourceAmounts } from "./claim-effects";
import { FloatingText } from "../../render/effects";

export type ProgressState = "projecting" | "awaiting_server_confirmation" | "confirmed_collectible";

export type ProgressViewModel = {
  state: ProgressState;
  projectedFill: number;
  sisu: BigNum;
  rewardMultiplier: number;
  level: number;
  firstPlayedAtMs: number;
  idleMode: boolean;
  canClaimInMs: number | null;
  canClaimAt: string | null;
  nextVerifyAtMs: number;
  pendingClaimIntent: boolean;
  fillRate: number;
  idleModePurchased: boolean;
};

let currentViewModel: ProgressViewModel = {
  state: "projecting",
  projectedFill: 0,
  sisu: { m: 1, e: 0 },
  rewardMultiplier: 1.0,
  level: 1,
  firstPlayedAtMs: 0,
  idleMode: false,
  canClaimInMs: null,
  canClaimAt: null,
  nextVerifyAtMs: 0,
  pendingClaimIntent: false,
  fillRate: 0,
  idleModePurchased: false
};

export function updateProjectedFill(deltaTimeMs: number) {
  if (currentViewModel.state !== "projecting" && currentViewModel.state !== "awaiting_server_confirmation") {
    return;
  }

  if (currentViewModel.state === "awaiting_server_confirmation") {
     if (currentViewModel.canClaimInMs !== null) {
        currentViewModel.canClaimInMs -= deltaTimeMs;
        if (currentViewModel.canClaimInMs <= 0) {
           // Local countdown reached the boundary: require server verification.
           currentViewModel.canClaimInMs = null;
           currentViewModel.nextVerifyAtMs = Date.now();
           currentViewModel.projectedFill = 100;
        }
        return;
     }

     // Waiting for the next server verification window.
     return;
  }

  // Project from server-provided remaining time, not from free-running local
  // assumptions, so client visual progression stays anchored to authority.
  if (currentViewModel.canClaimInMs !== null) {
    const before = currentViewModel.canClaimInMs;
    currentViewModel.canClaimInMs = Math.max(0, before - deltaTimeMs);
    const duration = getCycleDurationMs();
    const completed = Math.max(0, duration - currentViewModel.canClaimInMs);
    currentViewModel.projectedFill = Math.min(100, (completed / duration) * 100);

    if (currentViewModel.canClaimInMs <= 0) {
      // Local projection reached 100%. Show legacy full state immediately.
      currentViewModel.state = "confirmed_collectible";
      currentViewModel.canClaimInMs = 0;
      currentViewModel.nextVerifyAtMs = 0;
      currentViewModel.projectedFill = 100;
    }
  }
}

export function getStateFromSnapshot(snapshot: GameSnapshot) {
  currentViewModel.state = "awaiting_server_confirmation";
  currentViewModel.projectedFill = 0;
  currentViewModel.sisu = snapshot.state.sisu.current;
  currentViewModel.rewardMultiplier = snapshot.state.progress_bar.reward_multiplier;
  currentViewModel.level = snapshot.state.level;
  currentViewModel.firstPlayedAtMs = parseTimestamp(snapshot.state.first_played_at, snapshot.server_time);
  currentViewModel.idleMode = snapshot.state.idle_mode;
  currentViewModel.canClaimInMs = null;
  currentViewModel.canClaimAt = snapshot.state.projection_params.can_claim_at;
  currentViewModel.nextVerifyAtMs = 0;
  currentViewModel.pendingClaimIntent = false;
  currentViewModel.fillRate = snapshot.state.projection_params.fill_rate;
  currentViewModel.idleModePurchased = snapshot.state.features.idle_mode_purchased;
}

export function handleClaimInResult(result: ProgressClaimInResult) {
  currentViewModel.sisu = result.sisu.current;

  if (result.can_claim_in <= 100) {
    currentViewModel.state = "confirmed_collectible";
    currentViewModel.canClaimInMs = 0;
    currentViewModel.canClaimAt = result.can_claim_at ?? currentViewModel.canClaimAt;
    currentViewModel.fillRate = result.fill_rate;
    currentViewModel.projectedFill = 100;
    currentViewModel.nextVerifyAtMs = 0;
  } else {
    const duration = getCycleDurationMsFromRate(Date.now());

    // Initial scheduling at 0%: use server can_claim_in as the cycle duration.
    if (currentViewModel.projectedFill <= 0.001) {
      const cycleDurationMs = Math.max(1, result.can_claim_in);
      setCycleDurationMs(cycleDurationMs);
      currentViewModel.canClaimInMs = cycleDurationMs;
      currentViewModel.state = "projecting";
      currentViewModel.projectedFill = 0;
      currentViewModel.canClaimAt = result.can_claim_at ?? currentViewModel.canClaimAt;
      currentViewModel.fillRate = result.fill_rate;
      currentViewModel.nextVerifyAtMs = 0;
      return;
    }

    // Boundary verification says "not yet": wait locally until the returned
    // server time window elapses, then re-verify.
    currentViewModel.canClaimInMs = result.can_claim_in;
    currentViewModel.canClaimAt = result.can_claim_at ?? currentViewModel.canClaimAt;
    currentViewModel.fillRate = result.fill_rate;
    setCycleDurationMs(Math.max(duration, currentViewModel.canClaimInMs));
    currentViewModel.state = "awaiting_server_confirmation";
    currentViewModel.nextVerifyAtMs = Date.now() + result.can_claim_in;
    currentViewModel.projectedFill = 100;
  }
}

export function handleClaimRewardResult() {
  currentViewModel.state = "awaiting_server_confirmation";
  currentViewModel.projectedFill = 0;
  currentViewModel.canClaimInMs = null;
  currentViewModel.canClaimAt = null;
  currentViewModel.nextVerifyAtMs = 0;
  currentViewModel.pendingClaimIntent = false;
}

export function beginAsyncClaimResolution() {
  currentViewModel.state = "awaiting_server_confirmation";
  currentViewModel.projectedFill = 0;
  currentViewModel.canClaimInMs = null;
  currentViewModel.canClaimAt = null;
  // `pendingClaimIntent` already gates `shouldSendClaimIn`.
  // Keeping nextVerifyAt finite prevents a stuck loop if a reward command is queued.
  currentViewModel.nextVerifyAtMs = Date.now();
  currentViewModel.pendingClaimIntent = true;
}

export function handleClaimNotReadyError(canClaimInMs: number | null = null) {
  currentViewModel.state = "awaiting_server_confirmation";
  // After a collect attempt, stay visually reset at 0% while waiting for
  // authoritative reward readiness from the server.
  currentViewModel.projectedFill = 0;
  currentViewModel.canClaimInMs = null;
  currentViewModel.canClaimAt = null;
  const delay = canClaimInMs && canClaimInMs > 0 ? canClaimInMs : 110;
  currentViewModel.nextVerifyAtMs = Date.now() + delay;
}

export type EffectContext = {
  floatingTexts: FloatingText[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  popupPoint: { x: number; y: number } | null;
};

/**
 * Dispatches a server result to the appropriate progress view-model handler and
 * spawns reward effects when applicable.
 */
export function applyProgressResult(
  result: ServerResult,
  previousAmounts: ResourceAmounts | null,
  effects: EffectContext | null
) {
  if (result.type === "progress.claim_in.result") {
    if (currentViewModel.pendingClaimIntent) return;
    handleClaimInResult(result);
    return;
  }

  if (result.type === "progress.claim_reward.result") {
    currentViewModel.sisu = result.sisu.current;
    handleClaimRewardResult();

    if (effects && previousAmounts) {
      spawnProgressClaimRewardEffects(effects.floatingTexts, effects.canvas, effects.ctx, previousAmounts, {
        exp: result.exp,
        level: result.level,
        coins: result.coins,
        shards: result.shards,
        cores: result.cores
      }, effects.popupPoint);
    }

    return;
  }

  if (result.type === "command.error" && result.reason === "claim_not_ready") {
    if (result.sisu) {
      currentViewModel.sisu = result.sisu.current;
    }
    if (result.can_claim_at !== undefined) {
      currentViewModel.canClaimAt = result.can_claim_at ?? currentViewModel.canClaimAt;
    }
    handleClaimNotReadyError(result.can_claim_in ?? null);
    return;
  }

  if (result.type === "progress.set_idle_mode.result") {
    currentViewModel.idleMode = result.idle_mode;
    currentViewModel.fillRate = result.fill_rate;
    currentViewModel.canClaimAt = result.can_claim_at ?? currentViewModel.canClaimAt;

    // Recalculate canClaimInMs based on new fill rate if we are projecting
    if (currentViewModel.state === "projecting" && currentViewModel.canClaimInMs !== null) {
      const remainingFill = 100 - currentViewModel.projectedFill;
      currentViewModel.canClaimInMs = (remainingFill * 1000) / currentViewModel.fillRate;
      setCycleDurationMs((100 * 1000) / currentViewModel.fillRate);
    }
    return;
  }

  if (result.type === "shop.purchase.result") {
    if (result.item_id === "idle_mode") {
      currentViewModel.idleModePurchased = true;
    }
    if (result.item_id === "sisu_generator" && result.sisu) {
      currentViewModel.sisu = result.sisu.current;
      currentViewModel.canClaimAt = result.can_claim_at ?? currentViewModel.canClaimAt;
      if (typeof result.fill_rate === "number") {
        currentViewModel.fillRate = result.fill_rate;
      }
    }
  }

  if (result.type === "sisu.refill.result" || result.type === "sisu.upgrade_max.result") {
    currentViewModel.sisu = result.sisu.current;
    currentViewModel.canClaimAt = result.can_claim_at;
    currentViewModel.fillRate = result.fill_rate;
  }
}

export function getViewModel(): ProgressViewModel {
  return currentViewModel;
}

export function shouldSendClaimIn(nowMs: number) {
  if (currentViewModel.pendingClaimIntent) return false;
  if (currentViewModel.state !== "awaiting_server_confirmation") return false;
  if (currentViewModel.canClaimInMs !== null) return false;
  if (nowMs < currentViewModel.nextVerifyAtMs) return false;

  // Keep queue pressure low while still responsive at the boundary.
  currentViewModel.nextVerifyAtMs = nowMs + 110;
  return true;
}

export function setPendingClaimIntent(value: boolean) {
  currentViewModel.pendingClaimIntent = value;

  if (
    !value &&
    currentViewModel.state === "awaiting_server_confirmation" &&
    currentViewModel.canClaimInMs === null &&
    currentViewModel.nextVerifyAtMs > Date.now() + 5_000
  ) {
    // Recover from stale sentinel timestamps and force a fresh server probe.
    currentViewModel.nextVerifyAtMs = Date.now();
  }
}

export function hasPendingClaimIntent() {
  return currentViewModel.pendingClaimIntent;
}


function parseTimestamp(value: string | null | undefined, serverTime: string | null | undefined) {
  if (!value) return conservativeFallbackFirstPlayedAt(serverTime);

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return conservativeFallbackFirstPlayedAt(serverTime);

  return parsed;
}

function conservativeFallbackFirstPlayedAt(serverTime: string | null | undefined) {
  const parsedServerTime = serverTime ? Date.parse(serverTime) : Number.NaN;
  const safeNow = Number.isFinite(parsedServerTime) ? parsedServerTime : Date.now();
  // If the field is missing (for example stale cached snapshots), avoid
  // inventing fresh-account bonus locally and let server verification lead.
  // We use a large enough number to ensure no bonus is applied if we were still calculating it.
  return safeNow - (30 * 24 * 60 * 60 * 1000); 
}

const DEFAULT_CYCLE_DURATION_MS = 10_000;
let cycleDurationMs = DEFAULT_CYCLE_DURATION_MS;

function getCycleDurationMs() {
  return cycleDurationMs;
}

function setCycleDurationMs(value: number) {
  cycleDurationMs = Math.max(1, Math.floor(value));
}

function getCycleDurationMsFromRate(_nowMs: number) {
  const rate = currentViewModel.fillRate;
  if (rate <= 0) return DEFAULT_CYCLE_DURATION_MS;
  return Math.max(1, Math.floor((100 * 1000) / rate));
}
