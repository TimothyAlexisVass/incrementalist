import type { CloverHuntState } from "../../../net/protocol";
import {
  CLOVERFIELD_MAX_BACKGROUND_STAGE,
  CLOVERFIELD_SEARCH_CLICK_STEP
} from "../../../config";

export type CloverfieldViewModel = {
  authoritativeClickCount: number;
  localPendingClicks: number;
  queuedThresholdIntents: number;
  dispatchInFlight: boolean;
  backgroundStage: number;
  transitionFromStage: number | null;
  transitionStartedAt: number;
  transitionDurationMs: number;
};

const cloverfieldViewModel: CloverfieldViewModel = {
  authoritativeClickCount: 0,
  localPendingClicks: 0,
  queuedThresholdIntents: 0,
  dispatchInFlight: false,
  backgroundStage: 1,
  transitionFromStage: null,
  transitionStartedAt: 0,
  transitionDurationMs: 3333
};

export function getCloverfieldViewModel() {
  return cloverfieldViewModel;
}

export function syncCloverfieldFromSnapshot(
  cloverHunt: CloverHuntState | null | undefined,
  _now: number = performance.now()
) {
  const nextAuthoritativeClickCount = Math.max(0, cloverHunt?.click_count ?? 0);

  if (nextAuthoritativeClickCount < cloverfieldViewModel.authoritativeClickCount) {
    cloverfieldViewModel.localPendingClicks = 0;
    cloverfieldViewModel.queuedThresholdIntents = 0;
    cloverfieldViewModel.dispatchInFlight = false;
  }

  const nextStage = clampStage(cloverHunt?.background_stage ?? 1);

  if (nextStage !== cloverfieldViewModel.backgroundStage) {
    // Snapshot sync is authoritative state hydration, not a discovery event.
    // We update instantly here and only animate when a discovery result arrives.
    cloverfieldViewModel.backgroundStage = nextStage;
    cloverfieldViewModel.transitionFromStage = null;
    cloverfieldViewModel.transitionStartedAt = 0;
  }

  cloverfieldViewModel.authoritativeClickCount = nextAuthoritativeClickCount;
}

export function startCloverfieldBackgroundTransition(
  fromStage: number,
  toStage: number,
  now: number = performance.now()
) {
  const from = clampStage(fromStage);
  const to = clampStage(toStage);

  cloverfieldViewModel.backgroundStage = to;

  if (from === to) {
    cloverfieldViewModel.transitionFromStage = null;
    cloverfieldViewModel.transitionStartedAt = 0;
    return;
  }

  cloverfieldViewModel.transitionFromStage = from;
  cloverfieldViewModel.transitionStartedAt = now;
}

export function registerCloverfieldSearchClick() {
  cloverfieldViewModel.localPendingClicks += 1;

  while (cloverfieldViewModel.localPendingClicks >= CLOVERFIELD_SEARCH_CLICK_STEP) {
    cloverfieldViewModel.localPendingClicks -= CLOVERFIELD_SEARCH_CLICK_STEP;
    cloverfieldViewModel.queuedThresholdIntents += 1;
  }
}

export function canDispatchCloverfieldThresholdIntent() {
  return (
    cloverfieldViewModel.queuedThresholdIntents > 0 &&
    cloverfieldViewModel.dispatchInFlight === false
  );
}

export function beginCloverfieldThresholdDispatch() {
  if (!canDispatchCloverfieldThresholdIntent()) {
    return false;
  }

  cloverfieldViewModel.dispatchInFlight = true;
  return true;
}

export function finishCloverfieldThresholdDispatch(accepted: boolean) {
  if (accepted && cloverfieldViewModel.queuedThresholdIntents > 0) {
    cloverfieldViewModel.queuedThresholdIntents -= 1;
  }

  cloverfieldViewModel.dispatchInFlight = false;
}

export function clearCompletedCloverfieldTransition() {
  cloverfieldViewModel.transitionFromStage = null;
}

function clampStage(stage: number) {
  const normalized = Number.isFinite(stage) ? Math.floor(stage) : 1;
  return Math.min(CLOVERFIELD_MAX_BACKGROUND_STAGE, Math.max(1, normalized));
}
