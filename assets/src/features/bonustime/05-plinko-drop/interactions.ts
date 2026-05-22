import { GameChannel } from "../../../net/game-channel";
import { playBonusTime } from "../../../net/commands";
import { InteractionState } from "../../../ui/managers/interactions";
import {
  PlinkoDropData,
  getPlinkoAnimationDurationMs
} from "./view-model";
import {
  getBonusTimeWelcomeLayout,
  isPointInBonusTimeWelcomeButton,
  shouldOpenBonusTimeRewardModal
} from "../flow";

export enum PlinkoState {
  IDLE,
  PREPARING,
  READY,
  DROPPING,
  REVEALED
}

let internalState = PlinkoState.IDLE;
let waitingForResult = false;
let animationStartedAt = 0;
let requestStartedAt = 0;
let previousPlayedAt: string | null = null;
let resolvedPlayedAt: string | null = null;
let rewardModalStartTime = 0;
const RESULT_WAIT_TIMEOUT_MS = 5_000;

export function getPlinkoState() {
  return internalState;
}

export function getRewardWaitStartedAt() {
  return rewardModalStartTime;
}

export function isPlinkoWaitingForResult() {
  return waitingForResult;
}

export function getPlinkoAnimationStartedAt() {
  return animationStartedAt;
}

export function resetPlinkoState() {
  internalState = PlinkoState.IDLE;
  waitingForResult = false;
  animationStartedAt = 0;
  requestStartedAt = 0;
  previousPlayedAt = null;
  resolvedPlayedAt = null;
  rewardModalStartTime = 0;
}

export function handlePlinkoDropInteractions(
  input: InteractionState,
  data: PlinkoDropData,
  rect: { x: number; y: number; width: number; height: number },
  channel?: GameChannel,
  runCommand?: (cmd: () => Promise<any>) => void
) {
  const welcomeLayout = getBonusTimeWelcomeLayout(rect, {
    cardWidth: 460,
    cardHeight: 320,
    buttonWidth: 240,
    buttonHeight: 50,
    cardYOffset: -20,
    buttonOffsetY: 70
  });

  if (internalState === PlinkoState.IDLE && data.hasToken && channel) {
    if (isPointInBonusTimeWelcomeButton(input.pointer, welcomeLayout) && input.clicked && !input.consumed) {
      internalState = PlinkoState.PREPARING;
      waitingForResult = true;
      animationStartedAt = 0;
      requestStartedAt = performance.now();
      previousPlayedAt = data.lastPlayedAt;

      if (runCommand) {
        runCommand(() => playBonusTime(channel, "plinko_drop"));
      } else {
        playBonusTime(channel, "plinko_drop");
      }

      input.consumed = true;
    }
  }

  const isOverGameArea =
    !!input.pointer &&
    input.pointer.x >= rect.x &&
    input.pointer.x <= rect.x + rect.width &&
    input.pointer.y >= rect.y &&
    input.pointer.y <= rect.y + rect.height;

  if (isOverGameArea && input.clicked && !input.consumed) {
    if (internalState === PlinkoState.READY) {
      internalState = PlinkoState.DROPPING;
      animationStartedAt = performance.now();
      input.consumed = true;
    }
  }

  if (internalState === PlinkoState.PREPARING || internalState === PlinkoState.DROPPING) {
    const hasFreshResult =
      !!data.lastPlayedAt &&
      data.lastPlayedAt !== previousPlayedAt &&
      data.lastPlayedAt !== resolvedPlayedAt &&
      data.drops.length > 0;

    if (waitingForResult && hasFreshResult) {
      waitingForResult = false;
      requestStartedAt = 0;
      resolvedPlayedAt = data.lastPlayedAt;
      if (internalState === PlinkoState.PREPARING) {
        internalState = PlinkoState.READY;
      }
    }

    if (waitingForResult && requestStartedAt > 0) {
      const waitingMs = performance.now() - requestStartedAt;
      if (waitingMs >= RESULT_WAIT_TIMEOUT_MS) {
        internalState = PlinkoState.IDLE;
        waitingForResult = false;
        animationStartedAt = 0;
        requestStartedAt = 0;
      }
    }

    if (!waitingForResult && animationStartedAt > 0) {
      const elapsed = performance.now() - animationStartedAt;
      if (elapsed >= getPlinkoAnimationDurationMs(data)) {
        internalState = PlinkoState.REVEALED;
        rewardModalStartTime = performance.now();
      }
    }
  } else if (internalState === PlinkoState.REVEALED) {
    if (shouldOpenBonusTimeRewardModal(rewardModalStartTime, performance.now())) {
      return { type: "open_modal" as const };
    }
  }

  return null;
}
