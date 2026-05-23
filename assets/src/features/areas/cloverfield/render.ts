import {
  clearCompletedCloverfieldTransition,
  getCloverfieldViewModel
} from "./view-model";

export type CloverfieldBackgroundBlendState = {
  baseStage: number;
  mixStage: number | null;
  mixAmount: number;
};

export function getCloverfieldBackgroundBlendState(
  now: number = performance.now()
): CloverfieldBackgroundBlendState {
  const model = getCloverfieldViewModel();
  const currentStage = model.backgroundStage;
  const fromStage = model.transitionFromStage;

  if (fromStage === null || fromStage === currentStage) {
    return {
      baseStage: currentStage,
      mixStage: null,
      mixAmount: 0
    };
  }

  const elapsed = Math.max(0, now - model.transitionStartedAt);
  const progress = Math.min(1, elapsed / model.transitionDurationMs);

  if (progress >= 1) {
    clearCompletedCloverfieldTransition();

    return {
      baseStage: currentStage,
      mixStage: null,
      mixAmount: 0
    };
  }

  return {
    baseStage: fromStage,
    mixStage: currentStage,
    mixAmount: progress
  };
}
