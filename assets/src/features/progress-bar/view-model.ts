import type { GameSnapshot, ProgressClaimInResult, ProgressClaimRewardResult, ProjectionParams, ServerResult } from "../../net/protocol";
import { type BigNum, toNumber, ZERO, fromNumber } from "../../core/bignum";
import {
  BAR_RESET_LERP_SPEED,
} from "../../config";
import { spawnProgressClaimRewardEffects, type ResourceAmounts } from "./claim-effects";
import { FloatingText } from "../../render/effects";
import { getServerNow } from "../../core/time";

export type ProgressState = "projecting" | "awaiting_server_confirmation" | "confirmed_collectible";

export type ProgressViewModel = {
  state: ProgressState;
  projectedFill: number;
  sisu: BigNum;
  currentSisu: BigNum;
  targetSisu: BigNum;
  currentSisuDecay: number;
  targetSisuDecay: number;
  rewardMultiplier: number;
  level: number;
  firstPlayedAtMs: number;
  idleMode: boolean;
  canClaimInMs: number | null;
  canClaimAt: string | null;
  nextVerifyAtMs: number;
  pendingClaimIntent: boolean;
  idleModePurchased: boolean;
  snapshotAtMs: number;
  snapshotFill: number;
};

let currentViewModel: ProgressViewModel = {
  state: "projecting",
  projectedFill: 0,
  sisu: { m: 1, e: 0 },
  currentSisu: { m: 1, e: 0 },
  targetSisu: { m: 1, e: 0 },
  currentSisuDecay: 0,
  targetSisuDecay: 0,
  rewardMultiplier: 1.0,
  level: 1,
  firstPlayedAtMs: 0,
  idleMode: false,
  canClaimInMs: null,
  canClaimAt: null,
  nextVerifyAtMs: 0,
  pendingClaimIntent: false,
  idleModePurchased: false,
  snapshotAtMs: 0,
  snapshotFill: 0
};

const IDLE_MODE_BUFFER = 3000;

export function updateProjectedFill(deltaTimeMs: number) {
  if (currentViewModel.state !== "projecting" && currentViewModel.state !== "awaiting_server_confirmation") {
    return;
  }

  const now = getServerNow();

  if (currentViewModel.state === "awaiting_server_confirmation") {
    if (currentViewModel.canClaimInMs !== null) {
      currentViewModel.canClaimInMs -= deltaTimeMs;
      if (currentViewModel.canClaimInMs <= 0) {
        // Local countdown reached the boundary: require server verification.
        currentViewModel.canClaimInMs = null;
        currentViewModel.nextVerifyAtMs = now;
        currentViewModel.projectedFill = 100;
      }
      return;
    }

    // Waiting for the next server verification window.
    return;
  }

  if (currentViewModel.canClaimAt) {
    const endMs = Date.parse(currentViewModel.canClaimAt);
    const startMs = currentViewModel.snapshotAtMs;

    if (now >= endMs) {
      currentViewModel.state = "confirmed_collectible";
      currentViewModel.canClaimInMs = 0;
      currentViewModel.nextVerifyAtMs = 0;
      currentViewModel.projectedFill = 100;
      currentViewModel.sisu = currentViewModel.targetSisu;
      return;
    }

    const totalDuration = endMs - startMs;
    const elapsed = now - startMs;

    // In idle mode, we want to reach 100% visual fill 100ms early to allow
    // the "ready to collect" burst to be visible before automatic claim.
    const visualDuration = currentViewModel.idleMode ? Math.max(0, totalDuration - IDLE_MODE_BUFFER) : totalDuration;
    const visualProgress = visualDuration > 0 ? Math.min(1.0, Math.max(0.0, elapsed / visualDuration)) : 1.0;

    // Lerp progress bar
    currentViewModel.projectedFill = currentViewModel.snapshotFill + (100 - currentViewModel.snapshotFill) * visualProgress;

    // Lerp Sisu
    const sStart = toNumber(currentViewModel.currentSisu);
    const sEnd = toNumber(currentViewModel.targetSisu);
    const currentSValue = sStart + (sEnd - sStart) * visualProgress;
    currentViewModel.sisu = fromNumber(currentSValue);

    // Lerp Sisu Decay
    const dStart = currentViewModel.currentSisuDecay;
    const dEnd = currentViewModel.targetSisuDecay;
    currentViewModel.currentSisuDecay = dStart + (dEnd - dStart) * visualProgress;

    currentViewModel.canClaimInMs = endMs - now;
  }
}

export function getStateFromSnapshot(snapshot: GameSnapshot) {
  currentViewModel.state = "projecting";
  currentViewModel.projectedFill = snapshot.state.projection_params.current_fill;
  // TODO(TimothyAlexisVass): Looks like we're getting current sisu twice here?
  currentViewModel.sisu = snapshot.state.sisu.current;
  currentViewModel.currentSisu = snapshot.state.projection_params.current_sisu;
  currentViewModel.targetSisu = snapshot.state.projection_params.sisu_at_claim;
  currentViewModel.currentSisuDecay = snapshot.state.projection_params.current_sisu_decay;
  currentViewModel.targetSisuDecay = snapshot.state.projection_params.sisu_decay_at_claim;
  currentViewModel.rewardMultiplier = snapshot.state.progress_bar.reward_multiplier;
  currentViewModel.level = snapshot.state.level;
  currentViewModel.firstPlayedAtMs = parseTimestamp(snapshot.state.first_played_at, snapshot.server_time);
  currentViewModel.idleMode = snapshot.state.idle_mode;
  currentViewModel.canClaimAt = snapshot.state.projection_params.can_claim_at;
  currentViewModel.canClaimInMs = currentViewModel.canClaimAt ? Date.parse(currentViewModel.canClaimAt) - getServerNow() : null;
  currentViewModel.nextVerifyAtMs = 0;
  currentViewModel.pendingClaimIntent = false;
  currentViewModel.idleModePurchased = snapshot.state.features.idle_mode_purchased;
  currentViewModel.snapshotAtMs = getServerNow();
  currentViewModel.snapshotFill = snapshot.state.projection_params.current_fill;
}

export function handleClaimInResult(result: ProgressClaimInResult) {
  currentViewModel.sisu = result.sisu.current;
  applyProjectionData(result);

  if (result.can_claim_in <= 100) {
    currentViewModel.state = "confirmed_collectible";
    currentViewModel.canClaimInMs = 0;
    currentViewModel.projectedFill = 100;
    currentViewModel.nextVerifyAtMs = 0;
  } else {
    currentViewModel.state = "projecting";
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
  currentViewModel.nextVerifyAtMs = getServerNow();
  currentViewModel.pendingClaimIntent = true;
}

export function handleClaimNotReadyError(canClaimInMs: number | null = null) {
  currentViewModel.state = "awaiting_server_confirmation";
  currentViewModel.projectedFill = 0;
  currentViewModel.canClaimInMs = null;
  currentViewModel.canClaimAt = null;
  const delay = canClaimInMs && canClaimInMs > 0 ? canClaimInMs : 110;
  currentViewModel.nextVerifyAtMs = getServerNow() + delay;
}

function applyProjectionData(result: Partial<ProjectionParams>) {
  if (result.can_claim_at !== undefined) {
    currentViewModel.canClaimAt = result.can_claim_at;
  }
  if (result.current_fill !== undefined) {
    currentViewModel.snapshotFill = result.current_fill;
    currentViewModel.projectedFill = result.current_fill;
  }
  if (result.current_sisu !== undefined) {
    currentViewModel.currentSisu = result.current_sisu;
  }
  if (result.sisu_at_claim !== undefined) {
    currentViewModel.targetSisu = result.sisu_at_claim;
  }
  if (result.current_sisu_decay !== undefined) {
    currentViewModel.currentSisuDecay = result.current_sisu_decay;
  }
  if (result.sisu_decay_at_claim !== undefined) {
    currentViewModel.targetSisuDecay = result.sisu_decay_at_claim;
  }
  currentViewModel.snapshotAtMs = getServerNow();
}

export type EffectContext = {
  floatingTexts: FloatingText[];
  canvas: HTMLCanvasElement;
  popupPoint: { x: number; y: number } | null;
};

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
      spawnProgressClaimRewardEffects(effects.floatingTexts, effects.canvas, previousAmounts, {
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
    applyProjectionData(result);
    handleClaimNotReadyError(result.can_claim_in ?? null);
    return;
  }

  if (result.type === "progress.set_idle_mode.result") {
    currentViewModel.idleMode = result.idle_mode;
    applyProjectionData(result);
    currentViewModel.state = "projecting";
    return;
  }

  if (result.type === "shop.purchase.result") {
    if (result.item_id === "idle_mode") {
      currentViewModel.idleModePurchased = true;
    }
    if (result.sisu) {
      currentViewModel.sisu = result.sisu.current;
    }
    applyProjectionData(result);
    currentViewModel.state = "projecting";
    return;
  }

  if (result.type === "sisu.refill.result" || result.type === "sisu.upgrade_max.result") {
    currentViewModel.sisu = result.sisu.current;
    applyProjectionData(result);
    currentViewModel.state = "projecting";
    return;
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
    currentViewModel.nextVerifyAtMs > getServerNow() + 5_000
  ) {
    // Recover from stale sentinel timestamps and force a fresh server probe.
    currentViewModel.nextVerifyAtMs = getServerNow();
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
  const safeNow = Number.isFinite(parsedServerTime) ? parsedServerTime : getServerNow();
  return safeNow - (30 * 24 * 60 * 60 * 1000);
}
