import type { GameSnapshot, ProgressClaimInResult, ProgressClaimRewardResult } from "../../net/protocol";

export type ProgressState = "projecting" | "awaiting_server_confirmation" | "confirmed_collectible";

export type ProgressViewModel = {
  state: ProgressState;
  projectedFill: number;
  sisu: number;
  rewardMultiplier: number;
  idleMode: boolean;
  canClaimInMs: number | null;
};

let currentViewModel: ProgressViewModel = {
  state: "projecting",
  projectedFill: 0,
  sisu: 1,
  rewardMultiplier: 1.0,
  idleMode: false,
  canClaimInMs: null
};

const BASE_IDLE_MODE_OFF_FILL_RATE = 0.8;
const BASE_IDLE_MODE_ON_FILL_RATE = 0.24;

export function updateProjectedFill(deltaTimeMs: number) {
  if (currentViewModel.state !== "projecting" && currentViewModel.state !== "awaiting_server_confirmation") {
    return;
  }

  if (currentViewModel.state === "awaiting_server_confirmation") {
     if (currentViewModel.canClaimInMs !== null) {
        currentViewModel.canClaimInMs -= deltaTimeMs;
        if (currentViewModel.canClaimInMs <= 0) {
           currentViewModel.canClaimInMs = 0;
           currentViewModel.state = "confirmed_collectible";
        }
     }
     return;
  }

  const rate = currentViewModel.idleMode ? BASE_IDLE_MODE_ON_FILL_RATE : BASE_IDLE_MODE_OFF_FILL_RATE;
  const fillAmount = (rate * currentViewModel.sisu) * (deltaTimeMs / 1000);

  currentViewModel.projectedFill += fillAmount;
  if (currentViewModel.projectedFill >= 100) {
    currentViewModel.projectedFill = 100;
    currentViewModel.state = "awaiting_server_confirmation";
  }
}

export function getStateFromSnapshot(snapshot: GameSnapshot) {
  currentViewModel.state = "projecting";
  currentViewModel.projectedFill = 0;
  currentViewModel.sisu = snapshot.state.progress_bar.sisu;
  currentViewModel.rewardMultiplier = snapshot.state.progress_bar.reward_multiplier;
  currentViewModel.idleMode = snapshot.state.idle_mode;
  currentViewModel.canClaimInMs = null;
}

export function handleClaimInResult(result: ProgressClaimInResult) {
  if (result.can_claim_in <= 0) {
    currentViewModel.state = "confirmed_collectible";
  } else {
    currentViewModel.canClaimInMs = result.can_claim_in;
  }
}

export function handleClaimRewardResult() {
  currentViewModel.state = "projecting";
  currentViewModel.projectedFill = 0;
  currentViewModel.canClaimInMs = null;
}

export function getViewModel(): ProgressViewModel {
  return currentViewModel;
}
