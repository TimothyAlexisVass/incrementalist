import type { GameSnapshot, ProgressClaimInResult, ProgressClaimRewardResult } from "../../net/protocol";
import {
  BASE_IDLE_MODE_OFF_FILL_RATE,
  BASE_IDLE_MODE_ON_FILL_RATE,
  LATE_NEW_PLAYER_BONUS_FILL_MULTIPLIER,
  NEW_PLAYER_BONUS_FILL_BONUS,
  NEW_PLAYER_BONUS_FILL_MULTIPLIER,
  NEW_PLAYER_BONUS_WINDOW_MS
} from "../../config";

export type ProgressState = "projecting" | "awaiting_server_confirmation" | "confirmed_collectible";

export type ProgressViewModel = {
  state: ProgressState;
  projectedFill: number;
  sisu: number;
  rewardMultiplier: number;
  level: number;
  firstPlayedAtMs: number;
  idleMode: boolean;
  canClaimInMs: number | null;
  nextVerifyAtMs: number;
  pendingClaimIntent: boolean;
};

let currentViewModel: ProgressViewModel = {
  state: "projecting",
  projectedFill: 0,
  sisu: 1,
  rewardMultiplier: 1.0,
  level: 1,
  firstPlayedAtMs: 0,
  idleMode: false,
  canClaimInMs: null,
  nextVerifyAtMs: 0,
  pendingClaimIntent: false
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
  currentViewModel.sisu = snapshot.state.progress_bar.sisu;
  currentViewModel.rewardMultiplier = snapshot.state.progress_bar.reward_multiplier;
  currentViewModel.level = snapshot.state.level;
  currentViewModel.firstPlayedAtMs = parseTimestamp(snapshot.state.first_played_at, snapshot.server_time);
  currentViewModel.idleMode = snapshot.state.idle_mode;
  currentViewModel.canClaimInMs = null;
  currentViewModel.nextVerifyAtMs = 0;
  currentViewModel.pendingClaimIntent = false;
}

export function handleClaimInResult(result: ProgressClaimInResult) {
  if (result.can_claim_in <= 100) {
    currentViewModel.state = "confirmed_collectible";
    currentViewModel.canClaimInMs = 0;
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
      currentViewModel.nextVerifyAtMs = 0;
      return;
    }

    // Boundary verification says "not yet": wait locally until the returned
    // server time window elapses, then re-verify.
    currentViewModel.canClaimInMs = result.can_claim_in;
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
  currentViewModel.nextVerifyAtMs = 0;
  currentViewModel.pendingClaimIntent = false;
}

export function beginAsyncClaimResolution() {
  currentViewModel.state = "awaiting_server_confirmation";
  currentViewModel.projectedFill = 0;
  currentViewModel.canClaimInMs = null;
  // Pause normal verify loop while async claim resolution is running.
  currentViewModel.nextVerifyAtMs = Number.MAX_SAFE_INTEGER;
  currentViewModel.pendingClaimIntent = true;
}

export function handleClaimNotReadyError(canClaimInMs: number | null = null) {
  currentViewModel.state = "awaiting_server_confirmation";
  // After a collect attempt, stay visually reset at 0% while waiting for
  // authoritative reward readiness from the server.
  currentViewModel.projectedFill = 0;
  currentViewModel.canClaimInMs = null;
  const delay = canClaimInMs && canClaimInMs > 0 ? canClaimInMs : 110;
  currentViewModel.nextVerifyAtMs = Date.now() + delay;
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
}

export function hasPendingClaimIntent() {
  return currentViewModel.pendingClaimIntent;
}

function getProgressBarFillRate(viewModel: ProgressViewModel, nowMs: number) {
  const sisuMultiplier = Math.max(1, Number(viewModel.sisu) || 1);
  const baseRate = (
    viewModel.idleMode ? BASE_IDLE_MODE_ON_FILL_RATE : BASE_IDLE_MODE_OFF_FILL_RATE
  ) * sisuMultiplier;

  if (viewModel.idleMode) {
    return baseRate;
  }

  const gameAgeMs = nowMs - viewModel.firstPlayedAtMs;

  if (gameAgeMs < NEW_PLAYER_BONUS_WINDOW_MS) {
    return (baseRate * NEW_PLAYER_BONUS_FILL_MULTIPLIER) + NEW_PLAYER_BONUS_FILL_BONUS;
  }

  if (viewModel.level < 35) {
    return baseRate * LATE_NEW_PLAYER_BONUS_FILL_MULTIPLIER;
  }

  return baseRate;
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
  return safeNow - NEW_PLAYER_BONUS_WINDOW_MS;
}

const DEFAULT_CYCLE_DURATION_MS = 10_000;
let cycleDurationMs = DEFAULT_CYCLE_DURATION_MS;

function getCycleDurationMs() {
  return cycleDurationMs;
}

function setCycleDurationMs(value: number) {
  cycleDurationMs = Math.max(1, Math.floor(value));
}

function getCycleDurationMsFromRate(nowMs: number) {
  const rate = getProgressBarFillRate(currentViewModel, nowMs);
  if (rate <= 0) return DEFAULT_CYCLE_DURATION_MS;
  return Math.max(1, Math.floor((100 * 1000) / rate));
}
